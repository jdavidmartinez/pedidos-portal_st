# Plan de pruebas — Portal ST

## Objetivo

Evitar regresiones en el flujo de pedidos, la operación de cocina, el catálogo
administrable y el despliegue en Vercel. Las pruebas deben usar datos ficticios y
no deben depender de OpenWA: WhatsApp Desktop es un paso manual opcional desde
`/cocina`.

## Capas de prueba

### 1. Validación local obligatoria

Ejecutar antes de cada commit:

```bash
npm run lint
npm run test:unit
npm run typecheck
npm run build
git diff --check
```

La migración se verifica en un entorno Neon de desarrollo con:

```bash
npm run db:migrate
```

No se deben ejecutar migraciones destructivas ni usar datos reales para probar.

### 2. Pruebas unitarias (fase 1 implementada)

El runner es Vitest y se ejecuta con `npm run test:unit`. La primera batería
cubre funciones puras:

- `lib/orders/order-schema.ts`: datos válidos, campos obligatorios,
  presentación individual o combo, consentimiento, observaciones de máximo 500
  caracteres y estados permitidos.
- `lib/orders/date-range.ts`: fechas válidas, fechas imposibles y rango correcto
  de `America/Bogota`.
- `lib/orders/whatsapp-link.ts`: mensaje con y sin domicilio, observaciones,
  precios normales, total calculado y URL `whatsapp://` codificada.
- `lib/campaigns/campaign-schema.ts`: uno o varios productos, porcentajes, fechas y rangos válidos.
- `lib/menu/admin-menu-schema.ts`: precios, cantidades, imagen y categoría.
- `lib/auth/password.ts`: hash `scrypt` con sal, contraseña correcta, contraseña
  incorrecta y formatos de hash inválidos.

La persistencia de usuarios, sesiones, roles y límites de acceso se verifica en
la capa de integración porque depende de PostgreSQL y de las cookies de Next.js.

### 3. Pruebas de API e integración con Neon

Usar una base de datos de testing separada de desarrollo y producción, y limpiar
los datos de prueba por ejecución. La base Neon exclusiva ya fue creada y se
configura localmente mediante `.env.test` (ignorado por Git):

```bash
TEST_DATABASE_URL=postgresql://...
AUTH_SECRET=un-secreto-solo-para-pruebas
```

Después ejecuta:

```bash
npm run test:api
```

El comando aplica las migraciones a `TEST_DATABASE_URL`, verifica que no sea la
misma URL de producción y ejecuta las pruebas de API. Sin `TEST_DATABASE_URL`
no realiza ninguna conexión ni escritura.

1. `POST /api/orders` crea una orden y recalcula precios desde `menu_products`.
2. Una segunda petición con el mismo `Idempotency-Key` devuelve la misma orden y
   no crea una duplicada.
3. Productos inexistentes o inactivos son rechazados.
4. El consentimiento ausente o con versión incorrecta es rechazado.
5. `GET /api/orders` devuelve solo la fecha solicitada y respeta paginación.
6. `PATCH /api/orders/[id]` actualiza estado y domicilio, y calcula el total.
7. Las rutas protegidas responden `401` sin sesión.
8. La exportación CSV incluye encabezados, caracteres escapados y solo la fecha
   solicitada.
9. `GET /api/menu` devuelve únicamente categorías y productos activos con sus
   imágenes comic.
10. `/api/admin/menu` permite editar el catálogo solo con sesión válida.
11. `/api/admin/campaigns` permite crear y editar promociones con varios productos y
    rechaza rangos superpuestos; las órdenes conservan precios normales.
12. Un usuario `kitchen` puede operar pedidos pero recibe `403` en las APIs de
    administración; un usuario `admin` puede usar ambas áreas.
13. Cinco credenciales incorrectas activan el límite temporal y cerrar sesión
    revoca el token en PostgreSQL.
14. El cambio propio exige la contraseña actual, rechaza confirmaciones distintas
    y conserva solo una nueva sesión para el dispositivo actual.
15. El restablecimiento administrativo rechaza usuarios `kitchen`, actualiza el
    hash y revoca todas las sesiones del usuario afectado.
16. Una orden individual conserva el comportamiento anterior; una orden combo
    usa el precio combo canónico del catálogo y se rechaza cuando el producto no
    ofrece esa presentación.
17. `GET /api/menu` devuelve las 3 secciones y los 43 productos del catálogo
    aprobado, incluidos los precios individual y combo actualizados.
18. `GET /api/orders` entrega separadamente las órdenes del día y cualquier
    orden pendiente de días anteriores, sin incluir órdenes históricas ya
    despachadas o rechazadas.

### 4. Pruebas E2E del flujo de cliente

La primera suite automatizada usa Playwright con Chromium. Antes de ejecutarla
localmente, compila la aplicación y asegúrate de tener `.env.test` configurado:

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

Playwright inicia la aplicación compilada en `127.0.0.1:3100`. El setup crea
usuarios temporales `admin` y `kitchen` únicamente en Neon Testing y el teardown
los elimina. El flujo público intercepta las APIs de menú, pedidos y carga de
imágenes para no crear órdenes reales ni archivos en Blob.

En un navegador de prueba:

1. Abrir `/menu` y comprobar categorías, imágenes, precio individual y precio
   combo cuando esté disponible.
2. Agregar, aumentar y disminuir por separado las presentaciones individual y
   combo de un producto.
3. Confirmar que el carrito permanece visible durante el scroll.
4. Abrir el resumen, completar nombre, dirección, teléfono y observaciones.
5. Verificar que el formulario muestra el aviso de tratamiento de datos y que al
   pulsar “Enviar pedido” se registra el consentimiento con la versión vigente.
6. Enviar una orden y confirmar que el carrito se limpia al cerrar el flujo.
7. Recargar `/menu` y comprobar que el catálogo se mantiene desde Neon.

### 5. Pruebas E2E de cocina y administración

- `/cocina` redirige al login sin sesión.
- Usuarios `kitchen` y `admin` correctos entran y una contraseña incorrecta no.
- Un usuario `kitchen` es redirigido fuera de `/admin`; un `admin` puede abrir
  `/admin` y `/cocina`.
- `/cuenta` permite cambiar la contraseña y luego iniciar sesión con la nueva.
- `/admin/usuarios` permite restablecer una contraseña; las sesiones anteriores
  dejan de funcionar inmediatamente.
- Se muestran únicamente las órdenes del día.
- Las comandas y su formulario de edición distinguen las presentaciones
  individual y combo y conservan sus precios canónicos.
- Paginación y exportación por fecha funcionan.
- Los estados cambian en orden: recibida, aceptada, en proceso,
  despachada/rechazada.
- El timer inicia al recibir y se detiene al despachar o rechazar.
- El enlace de WhatsApp contiene el domicilio definido o
  `costo domicilio sin definir`.
- El botón de WhatsApp queda deshabilitado después de despachar.
- `/admin` permite editar nombre, categoría, precio, cantidad, disponibilidad e
  imagen; `/menu` refleja el cambio.
- `/admin` permite crear una promoción eligiendo varios productos, porcentaje y fechas;
  `/menu` muestra el popup sin cambiar precios ni totales.
- El contexto enviado a Gemini incluye secciones, descripciones y los precios
  individual y combo obtenidos del mismo catálogo activo.

## Smoke test de producción

Después de cada despliegue en Vercel:

1. Abrir `/menu` en ventana privada.
2. Crear una orden ficticia.
3. Entrar a `/cocina` y verificar la orden.
4. Cambiar su estado y domicilio.
5. Descargar un consolidado indicando fechas Desde y Hasta.
6. Confirmar en Network que `/api/menu` y `/api/orders` responden `200` y no
   exponen secretos.
7. Confirmar que una imagen de `*.public.blob.vercel-storage.com/menu-products/` responde `200`.

## Criterios de aprobación

Una versión puede pasar a producción cuando:

- lint, TypeScript y build terminan sin errores;
- las pruebas unitarias y de API pasan completamente;
- el smoke test de `/menu`, `/cocina` y `/admin` pasa en Preview;
- no aparecen errores `5xx` en las rutas de pedidos durante la prueba;
- no se usan datos personales reales ni credenciales de producción en pruebas.

## Pendientes explícitos

- [x] Crear y configurar `TEST_DATABASE_URL` en una base Neon independiente.
- [x] Ejecutar la primera batería de pruebas de API contra esa base.
- [x] Implementar autenticación y autorización con roles `admin` y `kitchen`.
- [x] Permitir el cambio propio de contraseña y el restablecimiento por un
  administrador.
- [x] Migrar las imágenes del menú y las campañas a Vercel Blob.
- [x] Implementar inventario de Blob, protección de imágenes compartidas,
  retención de huérfanos durante 30 días y limpieza administrativa.
- [x] Ampliar las pruebas de integración para cubrir administración del menú,
  campañas, permisos por rol, límite de intentos, cierre de sesión, cambio de
  contraseña y restablecimiento administrativo.
- [x] Integrar lint, TypeScript, pruebas unitarias, pruebas de API y build en CI
  antes de hacer merge a `master`.
- [x] Añadir pruebas E2E con Playwright para los flujos de cliente, cocina,
  administración, autenticación, campañas y carga de imágenes.
- [ ] Formalizar el smoke test de Preview y producción, registrando su resultado
  por despliegue.
- [x] Crear una base Neon exclusiva para desarrollo local, distinta de la base
  de testing y de producción, documentar las variables de cada ambiente y
  proteger los comandos locales contra conexiones cruzadas.
- [x] Programar la limpieza periódica de Blob y añadir pruebas automatizadas
  para ese proceso.
- [ ] Completar la activación de alertas de producción para errores `5xx`,
  fallos de Neon, errores de Blob y fallos en la creación de pedidos. Los logs,
  la instrumentación y el envío por webhook están implementados; falta
  configurar y probar `OBSERVABILITY_WEBHOOK_URL` en Vercel Production.
- [x] Documentar la política de copias, restauración y rollback de migraciones
  de Neon.
- [x] Permitir crear, activar, desactivar y cambiar roles de usuarios desde el
  panel administrativo.
- [x] Realizar una revisión de accesibilidad, navegación por teclado, contraste y
  experiencia móvil.

## Prioridades de implementación

| Prioridad | Estado | Trabajo | Avance estimado |
| --- | --- | --- | ---: |
| Crítica | Completado | Ampliar la cobertura de integración de APIs | 100% |
| Crítica | Completado | Integrar las validaciones automáticas en CI | 100% |
| Alta | Completado | Implementar pruebas E2E con Playwright | 100% |
| Alta | Manual | Formalizar el smoke test de Preview y producción | 20% |
| Alta | Completado | Separar completamente desarrollo, testing y producción | 100% |
| Alta | Completado | Completar las pruebas de autenticación y seguridad | 100% |
| Media | Completado | Automatizar y probar la limpieza periódica de Blob | 100% |
| Media | Parcial | Añadir observabilidad y alertas de producción | 85% |
| Media | Completado | Definir copias, recuperación y rollback de Neon | 100% |
| Media | Completado | Completar la administración de usuarios desde el panel | 100% |
| Baja | Completado | Revisar accesibilidad y experiencia móvil | 100% |

Los porcentajes describen el avance funcional estimado y deben actualizarse al
cerrar cada bloque. El orden recomendado es completar primero la cobertura de
integración y CI; después automatizar los flujos E2E y formalizar el smoke test.

## Integración continua en GitHub

El workflow `.github/workflows/ci.yml` se ejecuta en cada pull request dirigido a
`master`, en cada push a `master` y manualmente desde GitHub Actions. Se divide en
tres jobs:

1. `quality`: instala dependencias reproducibles con `npm ci`, restaura el caché
   de Next.js y ejecuta lint, TypeScript, pruebas unitarias y build de producción.
2. `api-integration`: aplica migraciones sobre la base Neon de testing y ejecuta
   toda la batería de integración con `npm run test:api`.
3. `e2e`: después de las pruebas de API, instala Chromium, compila la aplicación
   y ejecuta Playwright. Si falla, conserva durante siete días el reporte HTML,
   las capturas, los videos y las trazas disponibles.

El repositorio de GitHub debe tener estos secretos en `Settings > Secrets and
variables > Actions`:

- `TEST_DATABASE_URL`: conexión de la base Neon exclusiva para testing. Nunca
  debe apuntar a desarrollo ni a producción.
- `TEST_AUTH_SECRET`: secreto largo y exclusivo para sesiones creadas durante
  las pruebas; no debe coincidir con `AUTH_SECRET` de producción.

Si falta cualquiera de esos secretos, el job de integración falla explícitamente
en lugar de omitir las pruebas. Al configurar reglas de protección para
`master`, deben marcarse como obligatorios los checks `Lint, types, unit tests and
build`, `API integration tests (Neon)` y `End-to-end tests (Playwright)`.

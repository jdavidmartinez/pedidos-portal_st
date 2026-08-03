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
npx tsc --noEmit
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

- `lib/orders/order-schema.ts`: datos válidos, campos obligatorios, consentimiento,
  observaciones de máximo 500 caracteres y estados permitidos.
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

Usar una base de datos de desarrollo separada de producción y limpiar los datos
de prueba por ejecución. Configura un archivo local `.env.test` (ignorado por
Git) con una URL de Neon exclusiva para pruebas:

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

### 4. Pruebas E2E del flujo de cliente

En un navegador de prueba:

1. Abrir `/menu` y comprobar categorías, imágenes y precios.
2. Agregar, aumentar y disminuir productos.
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

## Smoke test de producción

Después de cada despliegue en Vercel:

1. Abrir `/menu` en ventana privada.
2. Crear una orden ficticia.
3. Entrar a `/cocina` y verificar la orden.
4. Cambiar su estado y domicilio.
5. Descargar un consolidado indicando fechas Desde y Hasta.
6. Confirmar en Network que `/api/menu` y `/api/orders` responden `200` y no
   exponen secretos.
7. Confirmar que una imagen de `/menu-comic-images/` responde `200`.

## Criterios de aprobación

Una versión puede pasar a producción cuando:

- lint, TypeScript y build terminan sin errores;
- las pruebas unitarias y de API pasan completamente;
- el smoke test de `/menu`, `/cocina` y `/admin` pasa en Preview;
- no aparecen errores `5xx` en las rutas de pedidos durante la prueba;
- no se usan datos personales reales ni credenciales de producción en pruebas.

## Pendientes explícitos

- [ ] Crear y configurar `TEST_DATABASE_URL` en una base Neon independiente.
- [ ] Ejecutar la primera batería de pruebas de API contra esa base.
- [ ] Definir e implementar autorización por roles; actualmente existe
  autenticación temporal compartida para cocina y administración.
- [ ] Añadir pruebas E2E con Playwright.
- [ ] Integrar las pruebas en CI antes de hacer merge a `master`.
- [ ] Registrar el requisito adicional pendiente de recordar y definir su
  criterio de aceptación antes de implementarlo.

## Orden recomendado de implementación

1. Completar las pruebas unitarias de autenticación.
2. Añadir pruebas de API con una base Neon de desarrollo.
3. Añadir Playwright para los flujos principales.
4. Integrar los comandos en CI antes de hacer merge a `master`.
5. Mantener el smoke test manual de Vercel como control final.

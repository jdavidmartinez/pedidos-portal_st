# Portal Pedidos

MVP para construir pedidos desde el menú de Portal ST y entregarlos a una
terminal interna de cocina.

## Desarrollo

```bash
npm install
npm run dev
```

Rutas principales:

- `http://localhost:3000/menu`: selección, revisión y confirmación del pedido.
- `http://localhost:3000/cocina`: órdenes recibidas y operación de cocina.

## Flujo actual

1. El cliente selecciona productos, agrega observaciones opcionales, acepta el aviso de tratamiento de datos y confirma sus datos en `/menu`.
   Gemini queda disponible como ayuda opcional, pero no es necesario para enviar la orden.
2. `POST /api/orders` valida los datos y recalcula los precios usando el menú
   canónico del servidor.
3. PostgreSQL en Neon guarda la orden y sus productos.
4. `/cocina` consulta cada cuatro segundos únicamente las órdenes del día actual, con paginación respaldada por Neon.
5. Cocina acepta, inicia preparación, despacha o rechaza cada orden.
6. El teléfono del cliente abre WhatsApp con la orden y el costo final
   prellenados. El envío del mensaje es manual.

La creación de órdenes usa una clave de idempotencia para que un reintento de
red no genere una comanda duplicada. Las órdenes anteriores permanecen en Neon
y pueden descargarse desde `/cocina` como un consolidado CSV seleccionando un
rango de fechas.

El aviso operativo de privacidad está disponible en `/tratamiento-datos` e
identifica a Grupo Empresarial PST SAS. La versión actual conserva los datos de
la orden hasta 12 meses después de la última orden, salvo obligaciones legales
aplicables.

WhatsApp no transporta las órdenes y no requiere API, QR ni sesión automatizada.

## Acceso y roles

`/cocina` requiere un usuario activo con rol `kitchen` o `admin`. `/admin` y
las APIs de catálogo y campañas requieren específicamente el rol `admin`.
Los usuarios, hashes de contraseña y sesiones revocables se guardan en Neon;
no existen credenciales compartidas ni contraseñas hardcodeadas.

Configura `AUTH_SECRET` en `.env.local` y en Vercel:

```bash
openssl rand -hex 32
```

Después de aplicar las migraciones, crea el primer administrador desde un
entorno seguro (no guardes estos valores en `.env.local`):

```bash
AUTH_USER_USERNAME=administrador \
AUTH_USER_PASSWORD='Una-clave-larga-123!' \
AUTH_USER_ROLE=admin \
npm run auth:create-user
```

El mismo comando crea usuarios de cocina usando `AUTH_USER_ROLE=kitchen`.
La contraseña debe contener al menos 12 caracteres, mayúscula, minúscula,
número y símbolo. El comando nunca reemplaza silenciosamente un usuario existente.

La sesión usa un token aleatorio en una cookie `httpOnly`, `SameSite=Lax`, con
expiración de 12 horas. Neon conserva únicamente el hash del token, por lo que
cerrar sesión lo revoca en el servidor. Cinco intentos fallidos para la misma
combinación de usuario y origen bloquean el acceso durante 15 minutos.

Cada usuario autenticado puede abrir `/cuenta` y cambiar su contraseña después
de confirmar la actual. La operación cierra sus demás sesiones y conserva la
sesión del dispositivo desde el que hizo el cambio. Un administrador puede
abrir `/admin/usuarios` para restablecer la contraseña de cualquier usuario;
este restablecimiento revoca todas las sesiones del usuario afectado. Si el
administrador restablece su propia contraseña desde esa sección, debe iniciar
sesión nuevamente.

Desde `/admin/usuarios` también puede crear usuarios, asignar los roles
`admin` o `kitchen`, y activar o desactivar cuentas. Cambiar el rol o el estado
revoca todas las sesiones del usuario. Un administrador no puede modificar su
propio rol ni desactivar su cuenta, y el sistema siempre conserva al menos un
administrador activo.
El `POST /api/orders` permanece público para que los clientes puedan enviar
pedidos; la consulta y actualización de órdenes requieren rol `kitchen` o
`admin`.

## Limitación del MVP

Las órdenes y el catálogo del menú se guardan en PostgreSQL mediante
`DATABASE_URL`. Las migraciones, incluida la carga inicial del catálogo, se
ejecutan con `npm run db:migrate`. La migración
`0006_marketing_consent.sql` permanece aplicada en Neon por compatibilidad.
La migración `0007_menu_comic_images.sql` asignó las rutas históricas del
catálogo y `0015_menu_blob_images.sql` las migró a imágenes WebP en Vercel
Blob. Las promociones son anuncios de
marketing asociados a uno o varios productos, una imagen propia opcional y un
rango de fechas. Se muestran en un popup
al abrir `/menu`, pero no modifican precios, pedidos, facturas ni mensajes de
WhatsApp. El restaurante decide manualmente si aplica el descuento anunciado.

`/menu` obtiene las categorías y productos activos desde `/api/menu`; el
`/admin` permite modificar esos registros sin editar el código de la
aplicación. Solo los usuarios con rol `admin` pueden acceder. Las imágenes se
pueden subir directamente a Vercel Blob en formato JPEG, PNG o WebP (máximo
4 MB), o indicar mediante una ruta local o URL.

Para habilitar las cargas, conecta un Blob store público al proyecto desde
Vercel (`Storage` > `Create Database` > `Blob`). Vercel agregará
`BLOB_READ_WRITE_TOKEN` al proyecto; vuelve a desplegar la aplicación después
de conectarlo. Para desarrollo local, descarga las variables con
`vercel env pull .env.local`. Las imágenes reemplazadas no se eliminan de
inmediato. `/admin` compara Blob con todas las referencias de productos y
campañas; conserva los archivos huérfanos durante 30 días desde su primera
detección y luego permite eliminarlos manualmente. Además, Vercel ejecuta
diariamente `/api/cron/blob-cleanup` a las 10:00 UTC. El endpoint exige
`CRON_SECRET` y aplica exactamente la misma política de retención. Las imágenes
compartidas o todavía vinculadas nunca se marcan como eliminables.

Configura `CRON_SECRET` en Vercel para Production con una cadena aleatoria de al
menos 16 caracteres. Vercel la enviará automáticamente como
`Authorization: Bearer <CRON_SECRET>` en cada ejecución programada. El cron se
registra al desplegar `vercel.json` y puede consultarse en `Settings > Cron Jobs`.

Consulta [el diseño del flujo de órdenes](docs/order-flow.md) para conocer el
contrato, estados, privacidad, paginación y exportación histórica.
El plan de verificación está en [docs/test-plan.md](docs/test-plan.md).

## Verificación

```bash
npm run lint
npm run test:unit
npm run typecheck
npm run build
```

Las pruebas de API contra Neon se ejecutan por separado con `npm run test:api`
después de configurar `TEST_DATABASE_URL` en `.env.test` usando una base
exclusiva para pruebas.

Las pruebas de navegador requieren Chromium y la aplicación compilada:

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

GitHub Actions ejecuta estas validaciones automáticamente para pull requests y
pushes a `master`. El job de integración requiere los secretos
`TEST_DATABASE_URL` y `TEST_AUTH_SECRET` configurados en el repositorio; consulta
[el plan de pruebas](docs/test-plan.md#integración-continua-en-github) para el
detalle y la protección recomendada de la rama.

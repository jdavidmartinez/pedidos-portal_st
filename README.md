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

## Acceso de cocina

`/cocina` requiere usuario y contraseña. En esta primera versión temporal las
credenciales están hardcodeadas en el servidor:

- Usuario: `cocina`
- Contraseña: `portalst`

Solo debes configurar `AUTH_SECRET` en `.env.local` y en Vercel:

```bash
openssl rand -hex 32
```

La sesión se firma con `AUTH_SECRET` y se guarda en una cookie `httpOnly` con expiración de 12 horas.
El `POST /api/orders` permanece público para que los clientes puedan enviar
pedidos; la consulta y actualización de órdenes requieren autenticación.

## Limitación del MVP

Las órdenes y el catálogo del menú se guardan en PostgreSQL mediante
`DATABASE_URL`. Las migraciones, incluida la carga inicial del catálogo, se
ejecutan con `npm run db:migrate`. La migración
`0006_marketing_consent.sql` permanece aplicada en Neon por compatibilidad.
La migración `0007_menu_comic_images.sql` asigna al catálogo las imágenes
públicas de `public/menu-comic-images`. La migración `0008_campaigns.sql`
agrega campañas de descuento y guarda una instantánea del descuento aplicado en
cada orden. El descuento afecta únicamente el total de productos del carrito;
el domicilio no recibe descuento.

`/menu` obtiene las categorías y productos activos desde `/api/menu`; el
`/admin` permite modificar esos registros sin editar el código de la
aplicación. Por ahora la autenticación de administrador reutiliza las
credenciales temporales de cocina y las imágenes se indican mediante una ruta
local o URL.

Consulta [el diseño del flujo de órdenes](docs/order-flow.md) para conocer el
contrato, estados, privacidad, paginación y exportación histórica.
El plan de verificación está en [docs/test-plan.md](docs/test-plan.md).

## Verificación

```bash
npm run lint
npm run test:unit
npx tsc --noEmit
npm run build
```

Las pruebas de API contra Neon se ejecutan por separado con `npm run test:api`
después de configurar `TEST_DATABASE_URL` en `.env.test` usando una base
exclusiva para pruebas.

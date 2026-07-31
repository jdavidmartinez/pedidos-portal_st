# Flujo de órdenes del MVP

## Objetivo

El pedido debe llegar desde `/menu` hasta `/cocina` sin depender de WhatsApp.
WhatsApp es únicamente una acción manual para confirmar el pedido y el costo
final con el cliente.

Gemini está disponible como asistente opcional para resolver dudas o ayudar a
revisar la selección. El flujo directo del carrito no llama a Gemini y es la
ruta principal para confirmar y enviar la orden.

## Recorrido

```text
  /menu
  → POST /api/orders
  → PostgreSQL (Neon)
  → GET /api/orders
  → /cocina
  → enlace whatsapp:// del cliente
```

## Contrato

Una orden contiene:

- identificador interno UUID;
- número consecutivo visible;
- nombre, dirección y teléfono normalizado del cliente;
- observaciones opcionales del cliente (máximo 500 caracteres);
- versión y fecha de aceptación del aviso de tratamiento de datos personales;
- clave de idempotencia para evitar duplicados por reintentos;
- productos, cantidades, precios unitarios y totales por línea;
- subtotal, domicilio y total;
- campaña aplicada (si existe), porcentaje, descuento y subtotal descontado;
- estado;
- fecha de recepción, última actualización y finalización.

El navegador no decide los precios. Solo envía nombres y cantidades; el servidor
valida cada producto activo en `menu_products` y calcula los valores canónicos.

Una campaña activa se selecciona por la fecha local de Colombia al crear la
orden. Para el MVP se aplica a todos los productos del pedido, redondeando el
descuento al peso. Los precios de las tarjetas del menú y de cada línea de la
comanda permanecen completos; el descuento se muestra únicamente en el resumen
del carrito, la comanda, el consolidado y el mensaje de WhatsApp. El costo de
domicilio nunca se descuenta. Solo puede existir una campaña activa por rango
de fechas superpuesto.

El navegador envía una clave `Idempotency-Key` por intento de pedido. Si la
misma petición se repite con la misma clave, la API devuelve la orden ya creada
en lugar de insertar una nueva.

El catálogo visible de `/menu` se carga desde `GET /api/menu`. Las categorías,
precios, imágenes y disponibilidad se mantienen en Neon para que la futura
sección de administración pueda actualizarlos sin modificar el código.

## Estados

```text
Recibida → Aceptada → En proceso → Despachada
    └────────┴────────────┴──────→ Rechazada
```

`Despachada` y `Rechazada` son estados terminales. El servidor rechaza
transiciones posteriores y no permite modificar el costo de domicilio.

El temporizador comienza en `receivedAt` y se detiene en `completedAt` cuando
la orden es despachada o rechazada.

## APIs

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/menu` | Devuelve las categorías, productos activos y campaña vigente para `/menu`. |
| `GET` | `/api/orders` | Lista las órdenes de una fecha, paginadas; por defecto usa el día actual en `America/Bogota`. |
| `POST` | `/api/orders` | Valida y crea una orden. |
| `PATCH` | `/api/orders/[id]` | Actualiza estado o costo de domicilio. |
| `GET` | `/api/orders/export?from=YYYY-MM-DD&until=YYYY-MM-DD` | Descarga el consolidado CSV de un rango inclusivo de fechas. |
| `GET` | `/api/admin/menu` | Lista el catálogo completo para administración. |
| `POST` | `/api/admin/menu` | Crea un producto del catálogo. |
| `PATCH` | `/api/admin/menu/[id]` | Edita un producto del catálogo. |
| `GET` | `/api/admin/campaigns` | Lista las campañas configuradas. |
| `POST` | `/api/admin/campaigns` | Crea una campaña de descuento. |
| `PATCH` | `/api/admin/campaigns/[id]` | Edita una campaña. |
| `DELETE` | `/api/admin/campaigns/[id]` | Borra una campaña del panel; los pedidos conservan su instantánea del descuento. |

Las respuestas usan `Cache-Control: no-store`. `GET /api/orders`, `GET
/api/orders/export` y `PATCH
/api/orders/[id]` requieren la sesión autenticada de cocina; `POST /api/orders`
permanece público para los clientes.

Antes de aceptar, preparar o despachar una orden, cocina debe guardar un costo
de domicilio definido, que puede ser `$0` cuando no tiene costo. Una orden puede
rechazarse sin domicilio. No se permiten valores negativos. La interfaz exige
el valor para las acciones que continúan el flujo y lo muestra con formato de
pesos colombianos; la API también aplica esta regla para evitar cambios de
estado por llamadas directas.

`/cocina` consulta únicamente el rango comprendido entre las 00:00 y las 24:00
de `America/Bogota`, no el día UTC del servidor. Las páginas usan 12 órdenes por
defecto y la exportación conserva las órdenes históricas en la base de datos.
El consolidado permite elegir una fecha inicial y una fecha final; ambas están
incluidas en el archivo CSV.

## Tratamiento de datos personales

Al continuar con el pedido, el cliente acepta el aviso disponible en
`/tratamiento-datos`, mostrado junto al botón de envío. Esta aceptación se guarda con la orden mediante
`data_consent_at` y `data_consent_version`. El aviso operativo v3 identifica a
Grupo Empresarial PST SAS y establece una
conservación de 12 meses después de la última orden, salvo obligaciones legales
aplicables.

## Administración del menú

`/admin` reutiliza la sesión autenticada de cocina durante el MVP. Permite
editar nombre, descripción, precios, categoría, orden, cantidad disponible,
disponibilidad y ruta o URL de imagen. Una cantidad vacía representa inventario
ilimitado; una cantidad de `0` oculta el producto y evita nuevos pedidos.
También permite crear productos. La carga de archivos todavía no
está conectada a Blob; mientras se preparan las fotos se pueden usar rutas
locales como `/menu-comic-images/hamburguesa-portal-comic.png`. La migración
`0007_menu_comic_images.sql` asigna automáticamente la ilustración
correspondiente a cada producto sembrado.

## Autenticación de cocina

`/cocina/login` crea una sesión firmada en una cookie `httpOnly` con duración de
12 horas. La primera versión usa temporalmente las credenciales `cocina` /
`portalst` hardcodeadas en el servidor. `AUTH_SECRET` sigue configurándose como
variable de entorno para firmar la sesión.

## Contacto por WhatsApp

El teléfono colombiano de diez dígitos se normaliza agregando el prefijo `57`.
También se aceptan números internacionales que ya incluyan su código de país.

`/cocina` genera un enlace directo para WhatsApp Desktop:

```text
whatsapp://send?phone=<telefono>&text=<mensaje-codificado>
```

El mensaje incluye número de orden, productos, subtotal, domicilio, total,
observaciones (si existen) y la pregunta de confirmación. Una persona debe
revisar y enviar el mensaje desde WhatsApp.

`/cocina` mantiene disponible el botón de envío aunque el domicilio no esté
definido. En ese caso el mensaje usa `costo domicilio sin definir` y un total
pendiente de ese valor.

## Almacenamiento

`OrderRepository` desacopla las APIs del almacenamiento.
`PostgresOrderRepository` persiste las órdenes y productos en Neon mediante el
driver oficial `@neondatabase/serverless`.

Las migraciones están en `db/migrations/` y se aplican con:

```bash
npm run db:migrate
```

La variable `DATABASE_URL` debe existir en `.env.local` para desarrollo y en
las variables de entorno de Vercel para cada ambiente.

Las migraciones `0003_menu_catalog.sql` y `0004_menu_product_quantity.sql`
crean `menu_categories` y `menu_products` y
siembra el catálogo inicial que antes estaba definido en archivos estáticos.
La migración `0005_order_idempotency_and_data_consent.sql` agrega la clave única
de idempotencia y los metadatos de consentimiento. La migración
`0006_marketing_consent.sql` permanece aplicada por compatibilidad.
`0008_campaigns.sql` crea las campañas y guarda en cada orden una instantánea
del descuento aplicado, para que los pedidos históricos no cambien cuando se
edite una campaña.
Los productos se pueden desactivar con `active = false` sin borrar su registro;
las órdenes guardan una copia del nombre y precio usados al momento de crearse.

## Migración futura a base de datos

La implementación actual ya usa una base de datos durable. Para una operación
real todavía debe añadirse:

1. historial de cambios de estado;
2. usuarios y roles de cocina en base de datos;
3. política de retención para teléfono y dirección;
4. actualizaciones en tiempo real o polling respaldado por almacenamiento
   compartido.

Hasta completar esos controles, el flujo debe considerarse un MVP.

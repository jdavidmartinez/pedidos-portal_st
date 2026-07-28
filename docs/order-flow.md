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
- productos, cantidades, precios unitarios y totales por línea;
- subtotal, domicilio y total;
- estado;
- fecha de recepción, última actualización y finalización.

El navegador no decide los precios. Solo envía nombres y cantidades; el servidor
valida cada producto activo en `menu_products` y calcula los valores canónicos.

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
| `GET` | `/api/menu` | Devuelve las categorías y productos activos para `/menu`. |
| `GET` | `/api/orders` | Lista las órdenes más recientes primero. |
| `POST` | `/api/orders` | Valida y crea una orden. |
| `PATCH` | `/api/orders/[id]` | Actualiza estado o costo de domicilio. |
| `GET` | `/api/admin/menu` | Lista el catálogo completo para administración. |
| `POST` | `/api/admin/menu` | Crea un producto del catálogo. |
| `PATCH` | `/api/admin/menu/[id]` | Edita un producto del catálogo. |

Las respuestas usan `Cache-Control: no-store`. `GET /api/orders` y `PATCH
/api/orders/[id]` requieren la sesión autenticada de cocina; `POST /api/orders`
permanece público para los clientes.

## Administración del menú

`/admin` reutiliza la sesión autenticada de cocina durante el MVP. Permite
editar nombre, descripción, precios, categoría, orden, cantidad disponible,
disponibilidad y ruta o URL de imagen. Una cantidad vacía representa inventario
ilimitado; una cantidad de `0` oculta el producto y evita nuevos pedidos.
También permite crear productos. La carga de archivos todavía no
está conectada a Blob; mientras se preparan las fotos se pueden usar rutas
locales como `/images/hamburguesa-portal.webp`.

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

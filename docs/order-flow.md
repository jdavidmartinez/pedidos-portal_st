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
- productos, presentación individual o combo, cantidades, precios unitarios y
  totales por línea;
- subtotal, domicilio y total;
- instantánea histórica de campaña y descuento para órdenes creadas antes del
  modelo de promociones informativas;
- estado;
- fecha de recepción, última actualización y finalización.

El navegador no decide los precios. Solo envía nombres, presentación y
cantidades; el servidor valida cada producto activo en `menu_products`, confirma
que la presentación combo esté disponible y calcula el precio individual o de
combo canónico.

Una promoción activa se selecciona por la fecha local de Colombia y se muestra
en un popup al abrir `/menu`. El anuncio incluye título, productos, imagen,
porcentaje y vigencia. Es exclusivamente informativo: el navegador y el
servidor conservan los precios normales, la orden se guarda sin descuento y el
mensaje de WhatsApp no menciona la promoción. El restaurante decide manualmente
si aplica el descuento al facturar. Solo puede existir una promoción activa por
rango de fechas superpuesto.

El navegador envía una clave `Idempotency-Key` por intento de pedido. Si la
misma petición se repite con la misma clave, la API devuelve la orden ya creada
en lugar de insertar una nueva.

El catálogo visible de `/menu` se carga desde `GET /api/menu`. Las categorías,
precios, imágenes y disponibilidad se mantienen en Neon para que la futura
sección de administración pueda actualizarlos sin modificar el código.
`docs/menu-portal-st.json` conserva la versión aprobada por el cliente como
referencia legible y la migración `0018_sync_client_menu.sql` sincroniza sus 3
secciones, 43 productos, descripciones y precios con Neon.

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
| `POST` | `/api/admin/campaigns` | Crea una promoción informativa para uno o varios productos. |
| `PATCH` | `/api/admin/campaigns/[id]` | Edita una promoción. |
| `DELETE` | `/api/admin/campaigns/[id]` | Borra una promoción del panel. |
| `PATCH` | `/api/auth/password` | Cambia la contraseña del usuario autenticado después de validar la actual. |
| `GET` | `/api/admin/users` | Lista usuarios para el panel administrativo. |
| `POST` | `/api/admin/users` | Crea un usuario con rol `admin` o `kitchen`. |
| `PATCH` | `/api/admin/users/[id]` | Cambia el rol o estado activo y revoca las sesiones del usuario. |
| `PATCH` | `/api/admin/users/[id]/password` | Restablece una contraseña y revoca las sesiones del usuario. |

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

Mientras la orden se encuentre en estado `Recibida`, cocina puede usar **Editar**
junto a **Aceptar en cocina** para corregir los datos del cliente, observaciones
y productos. El motivo de la corrección es opcional. El servidor vuelve a
validar los productos y precios vigentes, recalcula el subtotal normal y guarda una instantánea anterior
y posterior en `order_edits`. Después de aceptar, la orden deja de ser editable;
las órdenes finalizadas nunca se reescriben.

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

El cliente puede elegir **Recordar mis datos en este dispositivo**. Con su
elección, nombre, dirección y teléfono se guardan durante un máximo de 12 meses
en el almacenamiento local de ese navegador y se proponen, siempre editables,
en pedidos posteriores. La opción no identifica al cliente en otros dispositivos
ni constituye un inicio de sesión. **Olvidar mis datos** elimina inmediatamente
esa copia local.

## Administración del menú

`/admin` requiere una sesión con rol `admin`. Permite
editar nombre, descripción, precios, categoría, orden, cantidad disponible,
disponibilidad y ruta o URL de imagen. Una cantidad vacía representa inventario
ilimitado; una cantidad de `0` oculta el producto y evita nuevos pedidos.
El precio combo es opcional: cuando existe, `/menu` presenta dos alternativas
independientes para agregar el producto a la orden; cuando está vacío, solo
ofrece la presentación individual.

El asistente Gemini consulta el mismo catálogo activo de Neon en cada petición.
Recibe sección, nombre, descripción, precio individual y precio combo, por lo
que no mantiene una copia separada del menú ni precios definidos en el código.
También permite crear productos y subir imágenes JPEG, PNG o WebP a Vercel
Blob. La migración `0015_menu_blob_images.sql` trasladó las rutas históricas
del catálogo sembrado a sus versiones WebP en Blob.

## Autenticación y autorización

`/cocina/login` valida usuarios activos almacenados en PostgreSQL. Las
contraseñas se derivan con `scrypt` y una sal individual. Al autenticar, el
servidor emite un token aleatorio de sesión en una cookie `httpOnly` durante 12
horas y guarda únicamente su hash en `auth_sessions`. Cerrar sesión revoca el
registro y desactivar un usuario invalida sus sesiones inmediatamente.

Los roles `kitchen` y `admin` pueden consultar y operar pedidos. Solo `admin`
puede abrir `/admin` o usar las APIs de menú y campañas. La validación se repite
en cada API protegida; no depende de ocultar controles en el navegador. Los
intentos fallidos se limitan en PostgreSQL y se bloquean temporalmente al
alcanzar cinco fallos en una ventana de 15 minutos.

Desde `/cuenta`, cualquier usuario puede cambiar su propia contraseña
confirmando primero la actual. Se revocan sus otras sesiones y se emite una
nueva para el dispositivo actual. Desde `/admin/usuarios`, un administrador
puede restablecer la contraseña de otro usuario sin conocer la anterior; todas
las sesiones del usuario se revocan. Ambas funciones aplican la misma política:
12 a 128 caracteres con mayúscula, minúscula, número y símbolo.

## Contacto por WhatsApp

El teléfono colombiano de diez dígitos se normaliza agregando el prefijo `57`.
También se aceptan números internacionales que ya incluyan su código de país.

`/cocina` genera un enlace directo para WhatsApp Desktop:

```text
whatsapp://send?phone=<telefono>&text=<mensaje-codificado>
```

El mensaje incluye número de orden, productos con su presentación individual o
combo, subtotal, domicilio, total, observaciones (si existen) y la pregunta de
confirmación. La misma presentación queda visible en cocina y en la exportación
CSV. Una persona debe revisar y enviar el mensaje desde WhatsApp.

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
`0008_campaigns.sql` creó las campañas y las columnas históricas de descuento
en órdenes. `0009_order_edits.sql` conserva la auditoría de las
correcciones realizadas desde cocina y `0010_optional_order_edit_reason.sql`
permite omitir el motivo en instalaciones que ya habían aplicado la migración
anterior.
La migración `0011_role_based_auth.sql` crea usuarios con roles, sesiones
revocables y límites compartidos de intentos de acceso.
La migración `0012_marketing_promotions.sql` agregó el primer vínculo de
producto y desactiva campañas anteriores que todavía no lo tengan. La migración
`0013_promotion_products.sql` permite asociar varios productos a una misma
promoción. `0014_campaign_popup_image.sql` agrega la imagen propia opcional de
campaña, `0015_menu_blob_images.sql` migra el catálogo a Blob y
`0016_blob_orphan_lifecycle.sql` registra la retención de imágenes huérfanas. Las
columnas de descuento de órdenes se conservan únicamente por compatibilidad
histórica.
Los productos se pueden desactivar con `active = false` sin borrar su registro;
las órdenes guardan una copia del nombre y precio usados al momento de crearse.

## Migración futura a base de datos

La implementación actual ya usa una base de datos durable. Para una operación
real todavía debe añadirse:

1. historial de cambios de estado;
2. política de retención para teléfono y dirección;
3. actualizaciones en tiempo real o polling respaldado por almacenamiento
   compartido.

Hasta completar esos controles, el flujo debe considerarse un MVP.

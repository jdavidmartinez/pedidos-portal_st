# Flujo de órdenes del MVP

## Objetivo

El pedido debe llegar desde `/menu` hasta `/cocina` sin depender de WhatsApp.
WhatsApp es únicamente una acción manual para confirmar el pedido y el costo
final con el cliente.

## Recorrido

```text
  /menu
  → POST /api/orders
  → PostgreSQL (Neon)
  → GET /api/orders
  → /cocina
  → enlace wa.me del cliente
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
busca cada producto en `app/menu/data.ts` y calcula los valores canónicos.

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
| `GET` | `/api/orders` | Lista las órdenes más recientes primero. |
| `POST` | `/api/orders` | Valida y crea una orden. |
| `PATCH` | `/api/orders/[id]` | Actualiza estado o costo de domicilio. |

Las respuestas usan `Cache-Control: no-store`.

## Contacto por WhatsApp

El teléfono colombiano de diez dígitos se normaliza agregando el prefijo `57`.
También se aceptan números internacionales que ya incluyan su código de país.

`/cocina` genera:

```text
https://wa.me/<telefono>?text=<mensaje-codificado>
```

El mensaje incluye número de orden, productos, subtotal, domicilio, total,
observaciones (si existen) y la pregunta de confirmación. Una persona debe
revisar y enviar el mensaje desde WhatsApp.

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

## Migración futura a base de datos

La implementación actual ya usa una base de datos durable. Para una operación
real todavía debe añadirse:

1. historial de cambios de estado;
2. autenticación y autorización de la terminal de cocina;
3. política de retención para teléfono y dirección;
4. actualizaciones en tiempo real o polling respaldado por almacenamiento
   compartido.

Hasta completar esos controles, el flujo debe considerarse un MVP.

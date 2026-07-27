# Flujo de órdenes del MVP

## Objetivo

El pedido debe llegar desde `/menu` hasta `/cocina` sin depender de WhatsApp.
WhatsApp es únicamente una acción manual para confirmar el pedido y el costo
final con el cliente.

## Recorrido

```text
/menu
  → POST /api/orders
  → OrderRepository
  → GET /api/orders
  → /cocina
  → enlace wa.me del cliente
```

## Contrato

Una orden contiene:

- identificador interno UUID;
- número consecutivo visible;
- nombre, dirección y teléfono normalizado del cliente;
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

El mensaje incluye número de orden, productos, subtotal, domicilio, total y la
pregunta de confirmación. Una persona debe revisar y enviar el mensaje desde
WhatsApp.

## Almacenamiento temporal

`OrderRepository` desacopla las APIs del almacenamiento.
`InMemoryOrderRepository` usa un objeto de `globalThis` para conservar las
órdenes durante recargas de módulos en desarrollo.

Limitaciones:

- los datos se pierden al reiniciar Next.js;
- la numeración vuelve a comenzar;
- varias instancias no comparten órdenes;
- no ofrece garantías para Vercel;
- no existe auditoría ni recuperación.

## Migración futura a base de datos

La implementación durable debe conservar la interfaz de repositorio y añadir:

1. transacciones para asignar consecutivos;
2. restricciones para las transiciones de estado;
3. persistencia de fechas y costo de domicilio;
4. índices por estado y fecha de recepción;
5. historial de cambios;
6. autenticación y autorización de la terminal de cocina;
7. política de retención para teléfono y dirección;
8. actualizaciones en tiempo real o polling respaldado por almacenamiento
   compartido.

Hasta completar esa migración, el flujo solo debe considerarse un MVP local.

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

1. El cliente selecciona productos y confirma sus datos en `/menu`.
2. `POST /api/orders` valida los datos y recalcula los precios usando el menú
   canónico del servidor.
3. `/cocina` consulta las órdenes cada cuatro segundos.
4. Cocina acepta, inicia preparación, despacha o rechaza cada orden.
5. El teléfono del cliente abre WhatsApp con la orden y el costo final
   prellenados. El envío del mensaje es manual.

WhatsApp no transporta las órdenes y no requiere API, QR ni sesión automatizada.

## Limitación del MVP

Las órdenes se guardan temporalmente en memoria. Sobreviven a las recargas de
desarrollo, pero se pierden al reiniciar el proceso y no son confiables en
Vercel. Antes de usar el sistema con clientes reales debe implementarse una base
de datos y protegerse `/cocina`.

Consulta [el diseño del flujo de órdenes](docs/order-flow.md) para conocer el
contrato, estados y ruta de migración a almacenamiento durable.

## Verificación

```bash
npm run lint
npm run build
```

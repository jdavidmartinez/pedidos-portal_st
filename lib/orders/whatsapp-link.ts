import type { Order } from "@/types/order";

export type WhatsAppMessageKind = "order" | "dispatched";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);

export function buildOrderWhatsAppMessage(
  order: Order,
  deliveryFee: number | null,
  kind: WhatsAppMessageKind = "order"
) {
  if (kind === "dispatched") {
    return ["PORTAL ST — PEDIDO DESPACHADO", "", "Gracias por tu compra."].join(
      "\n"
    );
  }

  const items = order.items
    .map(
      (item) =>
        `${item.quantity}x ${item.name} — ${formatCOP(item.lineTotal)}`
    )
    .join("\n");
  const deliveryLine =
    deliveryFee === null ? "costo domicilio sin definir" : formatCOP(deliveryFee);
  const totalLine =
    deliveryFee === null
      ? "Pendiente del costo de domicilio"
      : formatCOP(order.subtotal + deliveryFee);
  return [
    "PORTAL ST",
    "",
    `Hola ${order.customer.name}, recibimos tu pedido:`,
    "",
    items,
    "",
    `Subtotal: ${formatCOP(order.subtotal)}`,
    `Domicilio: ${deliveryLine}`,
    `Total: ${totalLine}`,
    ...(order.observations
      ? ["", `Observaciones del cliente: ${order.observations}`]
      : []),
    "",
    "¿Estás de acuerdo con el pedido y con el costo final?",
  ].join("\n");
}

export function buildOrderWhatsAppUrl(
  order: Order,
  deliveryFee: number | null,
  kind: WhatsAppMessageKind = "order"
) {
  const message = buildOrderWhatsAppMessage(order, deliveryFee, kind);
  return `whatsapp://send?phone=${order.customer.phone}&text=${encodeURIComponent(message)}`;
}

import type { Order } from "@/types/order";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);

export function buildOrderWhatsAppMessage(
  order: Order,
  deliveryFee: number | null
) {
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
    "NUEVO PEDIDO — PORTAL ST",
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
  deliveryFee: number | null
) {
  const message = buildOrderWhatsAppMessage(order, deliveryFee);
  return `whatsapp://send?phone=${order.customer.phone}&text=${encodeURIComponent(message)}`;
}

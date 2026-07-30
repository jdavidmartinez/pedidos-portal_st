import { describe, expect, it } from "vitest";
import {
  buildOrderWhatsAppMessage,
  buildOrderWhatsAppUrl,
} from "@/lib/orders/whatsapp-link";
import type { Order } from "@/types/order";

const order: Order = {
  id: "order-test",
  number: 12,
  customer: {
    name: "Juan de prueba",
    address: "Calle 10 # 14-25",
    phone: "573213166885",
  },
  items: [
    {
      name: "HAMBURGUESA PORTAL",
      quantity: 2,
      unitPrice: 18000,
      lineTotal: 36000,
    },
  ],
  subtotal: 36000,
  deliveryFee: null,
  total: 36000,
  observations: "Sin cebolla",
  status: "received",
  receivedAt: "2026-07-29T14:00:00.000Z",
  updatedAt: "2026-07-29T14:00:00.000Z",
  completedAt: null,
};

describe("buildOrderWhatsAppMessage", () => {
  it("incluye el domicilio cuando está definido", () => {
    const message = buildOrderWhatsAppMessage(order, 7000);

    expect(message).toContain("PORTAL ST");
    expect(message).not.toContain("NUEVO PEDIDO");
    expect(message).toContain("Domicilio: $ 7.000");
    expect(message).toContain("Total: $ 43.000");
    expect(message).toContain("Observaciones del cliente: Sin cebolla");
  });

  it("indica cuando el costo del domicilio aún no está definido", () => {
    const message = buildOrderWhatsAppMessage(order, null);

    expect(message).toContain("Domicilio: costo domicilio sin definir");
    expect(message).toContain("Total: Pendiente del costo de domicilio");
  });
});

describe("buildOrderWhatsAppUrl", () => {
  it("genera un enlace de WhatsApp Desktop con mensaje codificado", () => {
    const url = buildOrderWhatsAppUrl(order, null);
    const decodedMessage = decodeURIComponent(url.split("text=")[1]);

    expect(url.startsWith("whatsapp://send?phone=573213166885&text=")).toBe(
      true
    );
    expect(decodedMessage).toContain("PORTAL ST");
    expect(decodedMessage).not.toContain("NUEVO PEDIDO");
  });

  it("genera un mensaje distinto cuando el pedido fue despachado", () => {
    const url = buildOrderWhatsAppUrl(order, 7000, "dispatched");
    const decodedMessage = decodeURIComponent(url.split("text=")[1]);

    expect(decodedMessage).toBe(
      "PORTAL ST — PEDIDO DESPACHADO\n\nGracias por tu compra."
    );
  });
});

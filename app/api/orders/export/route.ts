import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  getColombiaDateRange,
  InvalidOrderDateError,
} from "@/lib/orders/date-range";
import { orderRepository } from "@/lib/orders/order-repository";
import {
  getKitchenSession,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsv(orders: Awaited<ReturnType<typeof orderRepository.list>>["orders"]) {
  const rows = [
    [
      "Orden",
      "Recibida",
      "Cliente",
      "Teléfono",
      "Dirección",
      "Observaciones",
      "Productos",
      "Subtotal",
      "Domicilio",
      "Total",
      "Estado",
      "Finalizada",
    ],
    ...orders.map((order) => [
      `#${String(order.number).padStart(4, "0")}`,
      order.receivedAt,
      order.customer.name,
      `+${order.customer.phone}`,
      order.customer.address,
      order.observations,
      order.items
        .map((item) => `${item.quantity}x ${item.name}`)
        .join(" | "),
      order.subtotal,
      order.deliveryFee,
      order.total,
      order.status,
      order.completedAt,
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function GET(request: Request) {
  try {
    if (!(await getKitchenSession())) {
      return Response.json(
        { error: "Debes iniciar sesión para descargar las órdenes." },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const date = new URL(request.url).searchParams.get("date");
    if (!date) {
      return Response.json(
        { error: "Debes indicar una fecha para descargar el consolidado." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const { from, to } = getColombiaDateRange(date);
    const result = await orderRepository.list({
      from,
      to,
      limit: 50_000,
      offset: 0,
    });
    const csv = buildCsv(result.orders);

    return new Response(csv, {
      status: 200,
      headers: {
        ...noStoreHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ordenes-${date}.csv"`,
      },
    });
  } catch (error) {
    if (
      error instanceof KitchenAuthConfigError ||
      error instanceof DatabaseNotConfiguredError ||
      error instanceof InvalidOrderDateError
    ) {
      return Response.json(
        { error: error.message },
        { status: error instanceof InvalidOrderDateError ? 400 : 503, headers: noStoreHeaders }
      );
    }

    console.error("[orders-export] No fue posible generar el consolidado:", error);
    return Response.json(
      { error: "No fue posible generar el consolidado." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}


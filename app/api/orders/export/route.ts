import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  getColombiaDateRangeBetween,
  InvalidOrderDateError,
  InvalidOrderDateRangeError,
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

    const searchParams = new URL(request.url).searchParams;
    const legacyDate = searchParams.get("date");
    const fromDate = searchParams.get("from") || legacyDate;
    const toDate = searchParams.get("until") || legacyDate || fromDate;
    if (!fromDate || !toDate) {
      return Response.json(
        { error: "Debes indicar las fechas desde y hasta para descargar el consolidado." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const { from, to } = getColombiaDateRangeBetween(fromDate, toDate);
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
        "Content-Disposition": `attachment; filename="ordenes-${fromDate}-a-${toDate}.csv"`,
      },
    });
  } catch (error) {
    if (
      error instanceof KitchenAuthConfigError ||
      error instanceof DatabaseNotConfiguredError ||
      error instanceof InvalidOrderDateError ||
      error instanceof InvalidOrderDateRangeError
    ) {
      return Response.json(
        { error: error.message },
        {
          status:
            error instanceof InvalidOrderDateError ||
            error instanceof InvalidOrderDateRangeError
              ? 400
              : 503,
          headers: noStoreHeaders,
        }
      );
    }

    console.error("[orders-export] No fue posible generar el consolidado:", error);
    return Response.json(
      { error: "No fue posible generar el consolidado." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

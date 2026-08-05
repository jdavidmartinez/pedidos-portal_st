import { ZodError } from "zod";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  InvalidCustomerPhoneError,
  InvalidOrderItemError,
  orderRepository,
} from "@/lib/orders/order-repository";
import { createOrderSchema } from "@/lib/orders/order-schema";
import {
  getColombiaDateRange,
  getTodayInColombia,
  InvalidOrderDateError,
} from "@/lib/orders/date-range";
import {
  getKitchenSession,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";
import { recordOperationalEvent, reportOperationalError } from "@/lib/observability/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    if (!(await getKitchenSession())) {
      return Response.json(
        { error: "Debes iniciar sesión para consultar las órdenes." },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const requestUrl = new URL(request.url);
    const date = requestUrl.searchParams.get("date") || getTodayInColombia();
    const page = Math.max(1, Number(requestUrl.searchParams.get("page") || "1"));
    const pageSize = Math.min(
      50,
      Math.max(1, Number(requestUrl.searchParams.get("pageSize") || "12"))
    );

    if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
      return Response.json(
        { error: "Los parámetros de paginación no son válidos." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const { from, to } = getColombiaDateRange(date);
    const result = await orderRepository.list({
      from,
      to,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return Response.json(
      {
        orders: result.orders,
        pagination: {
          date,
          page,
          pageSize,
          total: result.total,
          hasNextPage: page * pageSize < result.total,
        },
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof KitchenAuthConfigError) {
      await reportOperationalError({ event: "auth.configuration_failed", operation: "orders.list", dependency: "auth", status: 503, error, route: "/api/orders" });
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    if (error instanceof DatabaseNotConfiguredError) {
      await reportOperationalError({ event: "neon.unavailable", operation: "orders.list", dependency: "neon", status: 503, error, route: "/api/orders" });
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    if (error instanceof InvalidOrderDateError) {
      return Response.json(
        { error: error.message },
        { status: 400, headers: noStoreHeaders }
      );
    }

    await reportOperationalError({ event: "orders.list_failed", operation: "orders.list", dependency: "neon", status: 500, error, route: "/api/orders" });
    return Response.json(
      { error: "No fue posible consultar las órdenes." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 160) {
      return Response.json(
        { error: "Falta una clave válida para evitar órdenes duplicadas." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const payload = createOrderSchema.parse(await request.json());
    const result = await orderRepository.create(payload, idempotencyKey);
    recordOperationalEvent({ event: "orders.create_succeeded", operation: "orders.create", dependency: "neon", durationMs: Date.now() - startedAt, result: result.created ? "created" : "duplicate" });
    return Response.json(
      { order: result.order, duplicate: !result.created },
      { status: result.created ? 201 : 200, headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Los datos de la orden no son válidos.", issues: error.issues },
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (
      error instanceof InvalidOrderItemError ||
      error instanceof InvalidCustomerPhoneError
    ) {
      return Response.json(
        { error: error.message },
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (error instanceof DatabaseNotConfiguredError) {
      await reportOperationalError({ event: "neon.unavailable", operation: "orders.create", dependency: "neon", status: 503, error, route: "/api/orders", requestId: request.headers.get("x-vercel-id") });
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "El cuerpo de la petición no contiene JSON válido." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    await reportOperationalError({ event: "orders.create_failed", operation: "orders.create", dependency: "neon", status: 500, error, route: "/api/orders", requestId: request.headers.get("x-vercel-id") });
    return Response.json(
      { error: error instanceof Error ? error.message : "No fue posible crear la orden." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

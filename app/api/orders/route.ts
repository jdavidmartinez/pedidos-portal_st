import { ZodError } from "zod";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  InvalidCustomerPhoneError,
  InvalidOrderItemError,
  orderRepository,
} from "@/lib/orders/order-repository";
import { createOrderSchema } from "@/lib/orders/order-schema";
import {
  getKitchenSession,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    if (!(await getKitchenSession())) {
      return Response.json(
        { error: "Debes iniciar sesión para consultar las órdenes." },
        { status: 401, headers: noStoreHeaders }
      );
    }

    return Response.json(
      { orders: await orderRepository.list() },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof KitchenAuthConfigError) {
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    console.error("[orders] No fue posible consultar las órdenes:", error);
    return Response.json(
      { error: "No fue posible consultar las órdenes." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = createOrderSchema.parse(await request.json());
    const order = await orderRepository.create(payload);
    return Response.json({ order }, { status: 201, headers: noStoreHeaders });
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

    console.error("[orders] No fue posible crear la orden:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "No fue posible crear la orden." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

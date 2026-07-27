import { ZodError } from "zod";
import {
  InvalidCustomerPhoneError,
  InvalidOrderItemError,
  orderRepository,
} from "@/lib/orders/order-repository";
import { createOrderSchema } from "@/lib/orders/order-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  return Response.json(
    { orders: orderRepository.list() },
    { headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  try {
    const payload = createOrderSchema.parse(await request.json());
    const order = orderRepository.create(payload);
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

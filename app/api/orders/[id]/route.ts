import { ZodError } from "zod";
import {
  InvalidOrderTransitionError,
  OrderNotFoundError,
  orderRepository,
} from "@/lib/orders/order-repository";
import { updateOrderSchema } from "@/lib/orders/order-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = updateOrderSchema.parse(await request.json());
    const order = orderRepository.update(id, payload);
    return Response.json({ order }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "La actualización no es válida.", issues: error.issues },
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (error instanceof OrderNotFoundError) {
      return Response.json(
        { error: error.message },
        { status: 404, headers: noStoreHeaders }
      );
    }

    if (error instanceof InvalidOrderTransitionError) {
      return Response.json(
        { error: error.message },
        { status: 409, headers: noStoreHeaders }
      );
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "El cuerpo de la petición no contiene JSON válido." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    console.error("[orders] No fue posible actualizar la orden:", error);
    return Response.json(
      { error: "No fue posible actualizar la orden." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

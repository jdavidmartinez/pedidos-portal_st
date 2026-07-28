import { ZodError } from "zod";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  getKitchenSession,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";
import { adminMenuProductSchema } from "@/lib/menu/admin-menu-schema";
import {
  MenuProductNotFoundError,
  menuRepository,
} from "@/lib/menu/menu-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: unknown }).code === "23505";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await getKitchenSession())) {
      return Response.json(
        { error: "Debes iniciar sesión para administrar el menú." },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const { id } = await params;
    const input = adminMenuProductSchema.parse(await request.json());
    const product = await menuRepository.updateProduct(id, input);
    return Response.json({ product }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    if (error instanceof ZodError) {
      return Response.json(
        { error: "Los datos del producto no son válidos.", issues: error.issues },
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (error instanceof MenuProductNotFoundError) {
      return Response.json(
        { error: error.message },
        { status: 404, headers: noStoreHeaders }
      );
    }

    if (isUniqueViolation(error)) {
      return Response.json(
        { error: "Ya existe otro producto con ese nombre." },
        { status: 409, headers: noStoreHeaders }
      );
    }

    console.error("[admin-menu] No fue posible actualizar el producto:", error);
    return Response.json(
      { error: "No fue posible actualizar el producto." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

import { ZodError } from "zod";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  getKitchenSession,
  hasRole,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";
import { adminMenuProductSchema } from "@/lib/menu/admin-menu-schema";
import { menuRepository } from "@/lib/menu/menu-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

async function requireKitchenSession() {
  return hasRole(await getKitchenSession(), ["admin"]);
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: unknown }).code === "23505";
}

export async function GET() {
  try {
    if (!(await requireKitchenSession())) {
      return Response.json(
        { error: "Necesitas permisos de administrador para administrar el menú." },
        { status: 403, headers: noStoreHeaders }
      );
    }

    return Response.json(
      { categories: await menuRepository.listAdmin() },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    console.error("[admin-menu] No fue posible consultar el catálogo:", error);
    return Response.json(
      { error: "No fue posible consultar el catálogo del menú." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireKitchenSession())) {
      return Response.json(
        { error: "Necesitas permisos de administrador para administrar el menú." },
        { status: 403, headers: noStoreHeaders }
      );
    }

    const input = adminMenuProductSchema.parse(await request.json());
    const product = await menuRepository.createProduct(input);
    return Response.json({ product }, { status: 201, headers: noStoreHeaders });
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

    if (isUniqueViolation(error)) {
      return Response.json(
        { error: "Ya existe un producto con ese nombre." },
        { status: 409, headers: noStoreHeaders }
      );
    }

    console.error("[admin-menu] No fue posible crear el producto:", error);
    return Response.json(
      { error: "No fue posible crear el producto." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

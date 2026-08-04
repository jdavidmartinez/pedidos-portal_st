import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  AuthUserNotFoundError,
  authRepository,
  LastActiveAdminError,
  type AuthRole,
} from "@/lib/auth/auth-repository";
import { getKitchenSession, hasRole } from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getKitchenSession();
    if (!session) {
      return Response.json({ error: "Debes iniciar sesión." }, { status: 401, headers: noStoreHeaders });
    }
    if (!hasRole(session, ["admin"])) {
      return Response.json({ error: "Necesitas permisos de administrador." }, { status: 403, headers: noStoreHeaders });
    }

    const { id } = await params;
    if (id === session.userId) {
      return Response.json(
        { error: "No puedes cambiar tu propio rol ni desactivar tu cuenta." },
        { status: 409, headers: noStoreHeaders }
      );
    }
    const payload = await request.json() as Record<string, unknown>;
    if (payload.role !== "admin" && payload.role !== "kitchen") {
      return Response.json({ error: "Selecciona un rol válido." }, { status: 400, headers: noStoreHeaders });
    }
    if (typeof payload.active !== "boolean") {
      return Response.json({ error: "El estado del usuario no es válido." }, { status: 400, headers: noStoreHeaders });
    }

    const user = await authRepository.updateUserAccess(
      id,
      payload.role as AuthRole,
      payload.active
    );
    return Response.json({ user }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "La solicitud no contiene JSON válido." }, { status: 400, headers: noStoreHeaders });
    }
    if (error instanceof AuthUserNotFoundError) {
      return Response.json({ error: error.message }, { status: 404, headers: noStoreHeaders });
    }
    if (error instanceof LastActiveAdminError) {
      return Response.json({ error: error.message }, { status: 409, headers: noStoreHeaders });
    }
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    console.error("[admin-users] No fue posible actualizar el usuario:", error);
    return Response.json({ error: "No fue posible actualizar el usuario." }, { status: 500, headers: noStoreHeaders });
  }
}

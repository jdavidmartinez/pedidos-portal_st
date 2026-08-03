import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { AuthUserNotFoundError, authRepository } from "@/lib/auth/auth-repository";
import { getPasswordPolicyError } from "@/lib/auth/password-policy";
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

    const payload = await request.json() as Record<string, unknown>;
    const policyError = getPasswordPolicyError(payload.newPassword);
    if (policyError) {
      return Response.json({ error: policyError }, { status: 400, headers: noStoreHeaders });
    }
    if (payload.newPassword !== payload.confirmation) {
      return Response.json({ error: "La confirmación no coincide con la nueva contraseña." }, { status: 400, headers: noStoreHeaders });
    }

    const { id } = await params;
    await authRepository.resetPassword(id, payload.newPassword as string);
    return Response.json(
      { ok: true, currentSessionRevoked: id === session.userId },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "La solicitud no contiene JSON válido." }, { status: 400, headers: noStoreHeaders });
    }
    if (error instanceof AuthUserNotFoundError) {
      return Response.json({ error: error.message }, { status: 404, headers: noStoreHeaders });
    }
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    console.error("[admin-users] No fue posible restablecer la contraseña:", error);
    return Response.json({ error: "No fue posible restablecer la contraseña." }, { status: 500, headers: noStoreHeaders });
  }
}

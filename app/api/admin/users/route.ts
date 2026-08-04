import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  AuthUsernameConflictError,
  authRepository,
  type AuthRole,
} from "@/lib/auth/auth-repository";
import { getPasswordPolicyError } from "@/lib/auth/password-policy";
import { getKitchenSession, hasRole } from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const session = await getKitchenSession();
    if (!session) {
      return Response.json({ error: "Debes iniciar sesión." }, { status: 401, headers: noStoreHeaders });
    }
    if (!hasRole(session, ["admin"])) {
      return Response.json({ error: "Necesitas permisos de administrador." }, { status: 403, headers: noStoreHeaders });
    }
    return Response.json({ users: await authRepository.listUsers() }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    console.error("[admin-users] No fue posible consultar los usuarios:", error);
    return Response.json({ error: "No fue posible consultar los usuarios." }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getKitchenSession();
    if (!session) {
      return Response.json({ error: "Debes iniciar sesión." }, { status: 401, headers: noStoreHeaders });
    }
    if (!hasRole(session, ["admin"])) {
      return Response.json({ error: "Necesitas permisos de administrador." }, { status: 403, headers: noStoreHeaders });
    }

    const payload = await request.json() as Record<string, unknown>;
    const username = typeof payload.username === "string" ? payload.username.trim() : "";
    const role = payload.role;
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
      return Response.json(
        { error: "El usuario debe tener entre 3 y 50 caracteres alfanuméricos, punto, guion o guion bajo." },
        { status: 400, headers: noStoreHeaders }
      );
    }
    if (role !== "admin" && role !== "kitchen") {
      return Response.json({ error: "Selecciona un rol válido." }, { status: 400, headers: noStoreHeaders });
    }
    const policyError = getPasswordPolicyError(payload.password);
    if (policyError) {
      return Response.json({ error: policyError }, { status: 400, headers: noStoreHeaders });
    }
    if (payload.password !== payload.confirmation) {
      return Response.json(
        { error: "La confirmación no coincide con la contraseña." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const user = await authRepository.createUser(
      username,
      payload.password as string,
      role as AuthRole
    );
    return Response.json({ user }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "La solicitud no contiene JSON válido." }, { status: 400, headers: noStoreHeaders });
    }
    if (error instanceof AuthUsernameConflictError) {
      return Response.json({ error: error.message }, { status: 409, headers: noStoreHeaders });
    }
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    console.error("[admin-users] No fue posible crear el usuario:", error);
    return Response.json({ error: "No fue posible crear el usuario." }, { status: 500, headers: noStoreHeaders });
  }
}

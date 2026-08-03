import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { authRepository } from "@/lib/auth/auth-repository";
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

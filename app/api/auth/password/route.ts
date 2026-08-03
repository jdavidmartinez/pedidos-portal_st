import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  AuthUserNotFoundError,
  authRepository,
  CurrentPasswordIncorrectError,
} from "@/lib/auth/auth-repository";
import { getPasswordPolicyError } from "@/lib/auth/password-policy";
import {
  getKitchenSession,
  setKitchenSessionCookie,
} from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function PATCH(request: Request) {
  try {
    const session = await getKitchenSession();
    if (!session) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para cambiar tu contraseña." },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const payload = await request.json() as Record<string, unknown>;
    const currentPassword = payload.currentPassword;
    const newPassword = payload.newPassword;
    const confirmation = payload.confirmation;
    if (typeof currentPassword !== "string" || currentPassword.length > 256) {
      return NextResponse.json(
        { error: "Escribe tu contraseña actual." },
        { status: 400, headers: noStoreHeaders }
      );
    }
    const policyError = getPasswordPolicyError(newPassword);
    if (policyError) {
      return NextResponse.json({ error: policyError }, { status: 400, headers: noStoreHeaders });
    }
    if (newPassword !== confirmation) {
      return NextResponse.json(
        { error: "La confirmación no coincide con la nueva contraseña." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    await authRepository.changePassword(session.userId, currentPassword, newPassword as string);
    const token = await authRepository.createSession(session.userId);
    const response = NextResponse.json({ ok: true });
    setKitchenSessionCookie(response, token);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400, headers: noStoreHeaders });
    }
    if (error instanceof CurrentPasswordIncorrectError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: noStoreHeaders });
    }
    if (error instanceof AuthUserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404, headers: noStoreHeaders });
    }
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    console.error("[auth] No fue posible cambiar la contraseña:", error);
    return NextResponse.json({ error: "No fue posible cambiar la contraseña." }, { status: 500, headers: noStoreHeaders });
  }
}

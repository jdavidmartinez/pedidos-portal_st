import { readBoundedJson } from "@/lib/http/bounded-json";
import { consumePublicRateLimit } from "@/lib/http/public-rate-limit";
import { RequestError, requestErrorResponse } from "@/lib/http/request-error";
import { getPasswordPolicyError } from "@/lib/auth/password-policy";
import { finishPasswordRecovery, INVALID_RESET_MESSAGE, validResetToken } from "@/lib/auth/password-recovery";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await consumePublicRateLimit("reset", request);
    const payload = await readBoundedJson(request, 4096);
    if (!payload || typeof payload !== "object") throw new RequestError("Solicitud inválida.", 400);
    const { token, password, confirmation } = payload as Record<string, unknown>;
    if (!validResetToken(token)) throw new RequestError(INVALID_RESET_MESSAGE, 400);
    const error = getPasswordPolicyError(password);
    if (error) throw new RequestError(error, 400);
    if (password !== confirmation) throw new RequestError("Las contraseñas no coinciden.", 400);
    if (!await finishPasswordRecovery(token, password as string)) throw new RequestError(INVALID_RESET_MESSAGE, 400);
    return Response.json({ message: "Contraseña actualizada. Inicia sesión con tu nueva contraseña." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestError) return requestErrorResponse(error);
    console.error("password_recovery.reset_failed");
    return Response.json({ error: "No fue posible cambiar la contraseña." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

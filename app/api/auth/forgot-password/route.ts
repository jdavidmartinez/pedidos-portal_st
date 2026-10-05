import { z } from "zod";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { consumePublicRateLimit } from "@/lib/http/public-rate-limit";
import { RequestError, requestErrorResponse } from "@/lib/http/request-error";
import { RECOVERY_MESSAGE, requestPasswordRecovery } from "@/lib/auth/password-recovery";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await consumePublicRateLimit("recovery", request);
    const parsed = z.object({ email: z.string().trim().max(254).email() }).safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success) throw new RequestError("Escribe un correo válido.", 400);
    try { await requestPasswordRecovery(parsed.data.email); }
    catch { console.error("password_recovery.request_failed"); }
    // Delivery errors and missing accounts share the same public response.
    return Response.json({ message: RECOVERY_MESSAGE }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestError) return requestErrorResponse(error);
    return Response.json({ error: "El servicio no está disponible temporalmente." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

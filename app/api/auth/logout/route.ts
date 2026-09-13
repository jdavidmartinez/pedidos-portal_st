import { reportRouteFailure, routeFailureStatus } from "@/lib/observability/route-failure";
import { NextResponse } from "next/server";
import {
  clearKitchenSessionCookie,
  revokeKitchenSession,
} from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let response = NextResponse.json<Record<string, unknown>>({ ok: true });
  try {
    await revokeKitchenSession();
  } catch (error) {
    await reportRouteFailure(error, "auth.logout", "/api/auth/logout", request);
    response = NextResponse.json({ error: "No fue posible revocar la sesión en el servidor." }, { status: routeFailureStatus(error) });
  }
  clearKitchenSessionCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

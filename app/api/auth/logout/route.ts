import { NextResponse } from "next/server";
import {
  clearKitchenSessionCookie,
  revokeKitchenSession,
} from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  try {
    await revokeKitchenSession();
  } catch (error) {
    console.error("[auth] No fue posible revocar la sesión:", error);
  }
  clearKitchenSessionCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

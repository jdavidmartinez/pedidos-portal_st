import { NextResponse } from "next/server";
import { clearKitchenSessionCookie } from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearKitchenSessionCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

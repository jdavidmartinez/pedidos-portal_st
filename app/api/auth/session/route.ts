import { NextResponse } from "next/server";
import {
  getKitchenSession,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getKitchenSession();
    return NextResponse.json(
      { authenticated: Boolean(session), username: session?.username ?? null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof KitchenAuthConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("[auth] No fue posible consultar la sesión:", error);
    return NextResponse.json(
      { error: "No fue posible consultar la sesión." },
      { status: 500 }
    );
  }
}

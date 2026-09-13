import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { reportRouteFailure } from "@/lib/observability/route-failure";
import { NextResponse } from "next/server";
import {
  getKitchenSession,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getKitchenSession();
    return NextResponse.json(
      {
        authenticated: Boolean(session),
        user: session
          ? { username: session.username, role: session.role }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      await reportRouteFailure(error, "auth.session", "/api/auth/session", request);
    }
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    await reportRouteFailure(error, "auth.session", "/api/auth/session", request);
    return NextResponse.json(
      { error: "No fue posible consultar la sesión." },
      { status: 500 }
    );
  }
}

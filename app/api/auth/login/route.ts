import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  authenticateKitchenUser,
  KitchenAuthConfigError,
  setKitchenSessionCookie,
} from "@/lib/auth/kitchen-auth";
import {
  InvalidCredentialsError,
  LoginRateLimitedError,
} from "@/lib/auth/auth-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    const username = typeof payload.username === "string" ? payload.username : "";
    const password = typeof payload.password === "string" ? payload.password : "";

    if (!username || !password || username.length > 50 || password.length > 256) {
      return NextResponse.json(
        { error: "Las credenciales no tienen un formato válido." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientAddress = forwardedFor?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")?.trim()
      || "unknown";
    const result = await authenticateKitchenUser(username, password, clientAddress);

    const response = NextResponse.json({
      ok: true,
      user: { username: result.user.username, role: result.user.role },
    });
    setKitchenSessionCookie(response, result.token);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "La solicitud no contiene JSON válido." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (error instanceof LoginRateLimitedError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }
    if (
      error instanceof KitchenAuthConfigError ||
      error instanceof DatabaseNotConfiguredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("[auth] No fue posible iniciar sesión:", error);
    return NextResponse.json(
      { error: "No fue posible iniciar sesión." },
      { status: 500 }
    );
  }
}

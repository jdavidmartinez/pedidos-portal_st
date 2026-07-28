import { NextResponse } from "next/server";
import {
  authenticateKitchenUser,
  KitchenAuthConfigError,
  setKitchenSessionCookie,
} from "@/lib/auth/kitchen-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    const username = typeof payload.username === "string" ? payload.username : "";
    const password = typeof payload.password === "string" ? payload.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Escribe el usuario y la contraseña." },
        { status: 400 }
      );
    }

    const token = authenticateKitchenUser(username, password);
    if (!token) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    setKitchenSessionCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof KitchenAuthConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("[auth] No fue posible iniciar sesión:", error);
    return NextResponse.json(
      { error: "No fue posible iniciar sesión." },
      { status: 500 }
    );
  }
}

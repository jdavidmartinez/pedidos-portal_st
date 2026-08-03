import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  authRepository,
  type AuthRole,
  type AuthSession,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/auth-repository";

export const KITCHEN_SESSION_COOKIE = "portal_auth_session";
export const KITCHEN_SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS;
export type KitchenSession = AuthSession;

export class KitchenAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KitchenAuthConfigError";
  }
}

export async function authenticateKitchenUser(
  username: string,
  password: string,
  clientAddress = "unknown"
) {
  try {
    const user = await authRepository.authenticate(username, password, clientAddress);
    return {
      token: await authRepository.createSession(user.id),
      user: { id: user.id, username: user.username, role: user.role },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("AUTH_SECRET")) {
      throw new KitchenAuthConfigError(error.message);
    }
    throw error;
  }
}

export async function getKitchenSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(KITCHEN_SESSION_COOKIE)?.value;
  return token ? authRepository.getSession(token) : null;
}

export async function revokeKitchenSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(KITCHEN_SESSION_COOKIE)?.value;
  if (token) await authRepository.revokeSession(token);
}

export function hasRole(session: AuthSession | null, roles: AuthRole[]) {
  return Boolean(session && roles.includes(session.role));
}

export function setKitchenSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: KITCHEN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: KITCHEN_SESSION_MAX_AGE,
    priority: "high",
  });
}

export function clearKitchenSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: KITCHEN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
}

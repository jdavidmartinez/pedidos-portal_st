import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const KITCHEN_SESSION_COOKIE = "portal_kitchen_session";
export const KITCHEN_SESSION_MAX_AGE = 60 * 60 * 12;
// Credenciales temporales del MVP. Migrarlas a usuarios seguros antes de producción.
const KITCHEN_USERNAME = "cocina";
const KITCHEN_PASSWORD = "portalst";

export class KitchenAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KitchenAuthConfigError";
  }
}

interface KitchenAuthConfig {
  username: string;
  secret: string;
}

export interface KitchenSession {
  username: string;
  expiresAt: number;
}

function getKitchenAuthConfig(): KitchenAuthConfig {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new KitchenAuthConfigError(
      "Falta AUTH_SECRET en las variables de entorno."
    );
  }

  return { username: KITCHEN_USERNAME, secret };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createSessionToken(username: string, secret: string) {
  const payload = encode(
    JSON.stringify({
      username,
      expiresAt: Math.floor(Date.now() / 1000) + KITCHEN_SESSION_MAX_AGE,
    })
  );
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function verifySessionToken(token: string, config: KitchenAuthConfig) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = createHmac("sha256", config.secret)
    .update(payload)
    .digest("base64url");
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(decode(payload)) as Partial<KitchenSession>;
    if (
      parsed.username !== config.username ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      username: parsed.username,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function authenticateKitchenUser(username: string, password: string) {
  const config = getKitchenAuthConfig();
  const isValid =
    safeEqual(username, config.username) &&
    safeEqual(password, KITCHEN_PASSWORD);

  return isValid ? createSessionToken(config.username, config.secret) : null;
}

export async function getKitchenSession() {
  const config = getKitchenAuthConfig();
  const cookieStore = await cookies();
  const token = cookieStore.get(KITCHEN_SESSION_COOKIE)?.value;

  return token ? verifySessionToken(token, config) : null;
}

export function setKitchenSessionCookie(
  response: Response,
  token: string
) {
  if (!("cookies" in response)) return;

  const responseCookies = (
    response as Response & {
      cookies: { set: (options: Record<string, unknown>) => void };
    }
  ).cookies;

  responseCookies.set({
    name: KITCHEN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: KITCHEN_SESSION_MAX_AGE,
  });
}

export function clearKitchenSessionCookie(response: Response) {
  if (!("cookies" in response)) return;

  const responseCookies = (
    response as Response & {
      cookies: { set: (options: Record<string, unknown>) => void };
    }
  ).cookies;

  responseCookies.set({
    name: KITCHEN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

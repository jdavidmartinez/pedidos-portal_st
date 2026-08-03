import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db/neon";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_FAILURES = 5;
const FALLBACK_PASSWORD_HASH =
  "scrypt$MDAwMDAwMDAwMDAwMDAwMA$w3fnYHfQdpVDsr1OFcTB9eUF17TeyBJR_CxETeRRh8L3Q50rgZwEalylHYNN0MZyuQ8J8TGKjoNAuYMSjU-U5w";

export type AuthRole = "admin" | "kitchen";

export interface AuthSession {
  userId: string;
  username: string;
  role: AuthRole;
  expiresAt: number;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: AuthRole;
  active: boolean;
}

interface SessionRow {
  user_id: string;
  username: string;
  role: AuthRole;
  expires_at: string;
}

interface LimitRow {
  failure_count: number | string;
  window_started_at: string;
  locked_until: string | null;
}

interface PublicUserRow {
  id: string;
  username: string;
  role: AuthRole;
  active: boolean;
  created_at: string;
}

export class InvalidCredentialsError extends Error {}
export class CurrentPasswordIncorrectError extends Error {}
export class AuthUserNotFoundError extends Error {}
export class LoginRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Demasiados intentos. Intenta nuevamente más tarde.");
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeUsername(username: string) {
  return username.trim().toLocaleLowerCase("es-CO");
}

function attemptKey(username: string, clientAddress: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${normalizeUsername(username)}\0${clientAddress}`)
    .digest("hex");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("Falta AUTH_SECRET en las variables de entorno.");
  return secret;
}

class PostgresAuthRepository {
  async authenticate(username: string, password: string, clientAddress: string) {
    const sql = getSql();
    const key = attemptKey(username, clientAddress, getAuthSecret());
    const now = Date.now();
    const limitRows = (await sql`
      SELECT failure_count, window_started_at, locked_until
      FROM auth_login_limits
      WHERE attempt_key = ${key}
    `) as unknown as LimitRow[];
    const limit = limitRows[0];

    if (limit?.locked_until) {
      const lockedUntil = new Date(limit.locked_until).getTime();
      if (lockedUntil > now) {
        throw new LoginRateLimitedError(Math.ceil((lockedUntil - now) / 1000));
      }
    }

    const rows = (await sql`
      SELECT id, username, password_hash, role, active
      FROM auth_users
      WHERE lower(username) = ${normalizeUsername(username)}
      LIMIT 1
    `) as unknown as UserRow[];
    const user = rows[0];
    const passwordMatches = await verifyPassword(
      password,
      user?.password_hash ?? FALLBACK_PASSWORD_HASH
    );

    if (!user || !user.active || !passwordMatches) {
      await sql`
        INSERT INTO auth_login_limits (
          attempt_key, failure_count, window_started_at, locked_until, updated_at
        ) VALUES (${key}, 1, now(), NULL, now())
        ON CONFLICT (attempt_key) DO UPDATE SET
          failure_count = CASE
            WHEN auth_login_limits.window_started_at < now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES})
              THEN 1
            ELSE auth_login_limits.failure_count + 1
          END,
          window_started_at = CASE
            WHEN auth_login_limits.window_started_at < now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES})
              THEN now()
            ELSE auth_login_limits.window_started_at
          END,
          locked_until = CASE
            WHEN (
              CASE
                WHEN auth_login_limits.window_started_at < now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES})
                  THEN 1
                ELSE auth_login_limits.failure_count + 1
              END
            ) >= ${LOGIN_MAX_FAILURES}
              THEN now() + make_interval(mins => ${LOGIN_WINDOW_MINUTES})
            ELSE NULL
          END,
          updated_at = now()
      `;
      throw new InvalidCredentialsError("Usuario o contraseña incorrectos.");
    }

    await sql`DELETE FROM auth_login_limits WHERE attempt_key = ${key}`;
    return user;
  }

  async createSession(userId: string) {
    const sql = getSql();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
    await sql.transaction([
      sql`DELETE FROM auth_sessions WHERE expires_at <= now()`,
      sql`
        INSERT INTO auth_sessions (token_hash, user_id, expires_at)
        VALUES (${tokenHash(token)}, ${userId}, ${expiresAt.toISOString()})
      `,
      sql`
        DELETE FROM auth_login_limits
        WHERE updated_at < now() - interval '24 hours'
      `,
    ]);
    return token;
  }

  async getSession(token: string): Promise<AuthSession | null> {
    const sql = getSql();
    const rows = (await sql`
      SELECT s.user_id, u.username, u.role, s.expires_at
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash(token)}
        AND s.expires_at > now()
        AND u.active = TRUE
      LIMIT 1
    `) as unknown as SessionRow[];
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      username: row.username,
      role: row.role,
      expiresAt: Math.floor(new Date(row.expires_at).getTime() / 1000),
    };
  }

  async revokeSession(token: string) {
    const sql = getSql();
    await sql`DELETE FROM auth_sessions WHERE token_hash = ${tokenHash(token)}`;
  }

  async listUsers() {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, username, role, active, created_at
      FROM auth_users
      ORDER BY lower(username)
    `) as unknown as PublicUserRow[];
    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role,
      active: row.active,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, username, password_hash, role, active
      FROM auth_users
      WHERE id = ${userId} AND active = TRUE
      LIMIT 1
    `) as unknown as UserRow[];
    const user = rows[0];
    if (!user) throw new AuthUserNotFoundError("El usuario no existe o está inactivo.");
    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      throw new CurrentPasswordIncorrectError("La contraseña actual es incorrecta.");
    }
    if (await verifyPassword(newPassword, user.password_hash)) {
      throw new CurrentPasswordIncorrectError("La nueva contraseña debe ser diferente de la actual.");
    }

    const passwordHash = await hashPassword(newPassword);
    await sql.transaction([
      sql`
        UPDATE auth_users
        SET password_hash = ${passwordHash}, updated_at = now()
        WHERE id = ${userId} AND active = TRUE
      `,
      sql`DELETE FROM auth_sessions WHERE user_id = ${userId}`,
    ]);
  }

  async resetPassword(userId: string, newPassword: string) {
    const sql = getSql();
    const users = (await sql`
      SELECT id FROM auth_users WHERE id = ${userId} LIMIT 1
    `) as unknown as Array<{ id: string }>;
    if (users.length === 0) throw new AuthUserNotFoundError("El usuario no existe.");
    const passwordHash = await hashPassword(newPassword);
    await sql.transaction([
      sql`
        UPDATE auth_users
        SET password_hash = ${passwordHash}, updated_at = now()
        WHERE id = ${userId}
      `,
      sql`DELETE FROM auth_sessions WHERE user_id = ${userId}`,
    ]);
  }
}

export const authRepository = new PostgresAuthRepository();

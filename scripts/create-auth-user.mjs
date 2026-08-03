import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

const scrypt = promisify(scryptCallback);
const databaseUrl = process.env.DATABASE_URL?.trim();
const username = process.env.AUTH_USER_USERNAME?.trim();
const password = process.env.AUTH_USER_PASSWORD ?? "";
const role = process.env.AUTH_USER_ROLE?.trim().toLowerCase();

if (!databaseUrl) throw new Error("DATABASE_URL no está configurada.");
if (!username || !/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
  throw new Error("AUTH_USER_USERNAME debe tener 3-50 caracteres alfanuméricos, punto, guion o guion bajo.");
}
if (
  password.length < 12 ||
  !/[a-z]/.test(password) ||
  !/[A-Z]/.test(password) ||
  !/[0-9]/.test(password) ||
  !/[^a-zA-Z0-9]/.test(password)
) {
  throw new Error("AUTH_USER_PASSWORD debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.");
}
if (role !== "admin" && role !== "kitchen") {
  throw new Error("AUTH_USER_ROLE debe ser admin o kitchen.");
}

const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
const sql = neon(databaseUrl);
const inserted = await sql`
  INSERT INTO auth_users (id, username, password_hash, role)
  VALUES (${randomUUID()}, ${username}, ${passwordHash}, ${role})
  ON CONFLICT (lower(username)) DO NOTHING
  RETURNING username, role
`;

if (inserted.length === 0) {
  throw new Error(`El usuario "${username}" ya existe; no se modificó.`);
}

console.log(`[auth] Usuario ${username} creado con rol ${role}.`);

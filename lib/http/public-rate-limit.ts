import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getSql } from "@/lib/db/neon";
import { reportOperationalError } from "@/lib/observability/server";
import { RequestError } from "./request-error";

export const PUBLIC_RATE_POLICIES = {
  orders: { limit: 20, windowSeconds: 600 },
  chat: { limit: 12, windowSeconds: 60 },
} as const;
export type PublicRateScope = keyof typeof PUBLIC_RATE_POLICIES;

export function publicRateKey(scope: PublicRateScope, request: Request) {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) throw new Error("PublicRateLimitNotConfigured");
  // Only trust forwarding headers set by Vercel's ingress. Local/other hosts
  // share a fallback bucket; arbitrary client headers cannot select a new key.
  const candidate = process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.trim() ?? ""
    : "";
  let identity = "unknown";
  if (isIP(candidate) === 4) identity = candidate;
  if (isIP(candidate) === 6) {
    // Canonicalize alternate IPv6 spellings and group privacy addresses by /64.
    const canonical = new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
    const [left, right] = canonical.split("::");
    const first = left ? left.split(":") : [];
    const last = right ? right.split(":") : [];
    const parts = canonical.includes("::")
      ? [...first, ...Array(8 - first.length - last.length).fill("0"), ...last]
      : first;
    // Treat IPv4-mapped IPv6 consistently with IPv4.
    if (parts.slice(0, 5).every(part => parseInt(part, 16) === 0) && parts[5] === "ffff") {
      const value = parseInt(parts[6], 16) * 65536 + parseInt(parts[7], 16);
      identity = [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join(".");
    } else identity = parts.slice(0, 4).map(part => parseInt(part, 16).toString(16)).join(":") + "::/64";
  }
  return createHmac("sha256", secret).update(`public-api:${scope}:${identity}`).digest("hex");
}

export async function consumePublicRateLimit(scope: PublicRateScope, request: Request) {
  try {
    const key = publicRateKey(scope, request);
    const policy = PUBLIC_RATE_POLICIES[scope];
    // One atomic upsert serializes concurrent arrivals. The database clock owns
    // the window; denied requests neither extend it nor grow the counter forever.
    const rows = await getSql().query(`
      WITH cleanup AS (
        DELETE FROM public_api_rate_limits WHERE bucket_key IN (
          SELECT bucket_key FROM public_api_rate_limits
          WHERE expires_at < now() - interval '1 day' AND bucket_key <> $1
          ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
        )
      )
      INSERT INTO public_api_rate_limits (bucket_key, request_count, expires_at)
      VALUES ($1, 1, now() + make_interval(secs => $2))
      ON CONFLICT (bucket_key) DO UPDATE SET
        request_count = CASE WHEN public_api_rate_limits.expires_at <= now() THEN 1
          ELSE LEAST(public_api_rate_limits.request_count + 1, $3 + 1) END,
        expires_at = CASE WHEN public_api_rate_limits.expires_at <= now()
          THEN now() + make_interval(secs => $2) ELSE public_api_rate_limits.expires_at END
      RETURNING request_count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - now())))::int AS retry_after
    `, [key, policy.windowSeconds, policy.limit], {
      arrayMode: false,
      fullResults: false,
      fetchOptions: { signal: AbortSignal.timeout(5000) },
    });
    if (!rows[0]) throw new Error("PublicRateLimitEmptyResult");
    if (Number(rows[0].request_count) > policy.limit) {
      throw new RequestError("Has enviado demasiadas solicitudes. Espera un momento e inténtalo nuevamente.", 429, Number(rows[0].retry_after));
    }
  } catch (error) {
    if (error instanceof RequestError) throw error;
    await reportOperationalError({ event: "public_api.limiter_unavailable", operation: `public_api.${scope}`, dependency: "neon", status: 503, error });
    throw new RequestError("El servicio no está disponible temporalmente. Inténtalo nuevamente.", 503);
  }
}

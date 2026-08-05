import "server-only";

export type OperationalDependency =
  | "application"
  | "auth"
  | "blob"
  | "gemini"
  | "neon";

interface OperationalErrorInput {
  event: string;
  operation: string;
  status: 500 | 503;
  dependency: OperationalDependency;
  error: unknown;
  route?: string;
  requestId?: string | null;
}

interface OperationalInfoInput {
  event: string;
  operation: string;
  dependency?: OperationalDependency;
  durationMs?: number;
  result?: "created" | "duplicate" | "success";
}

const ALERT_TIMEOUT_MS = 2_500;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const recentAlerts = new Map<string, number>();

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { errorName: "UnknownError" };
  }

  const errorWithMetadata = error as Error & { code?: unknown; digest?: unknown };
  return {
    errorName: error.name || "Error",
    errorCode: typeof errorWithMetadata.code === "string"
      ? errorWithMetadata.code.slice(0, 80)
      : undefined,
    errorDigest: typeof errorWithMetadata.digest === "string"
      ? errorWithMetadata.digest.slice(0, 120)
      : undefined,
  };
}

function environmentName() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
}

function deploymentReference() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || undefined;
}

function writeEvent(event: Record<string, unknown>) {
  console.error(JSON.stringify(event));
}

function validWebhookUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

async function sendAlert(event: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return;
  const webhookUrl = validWebhookUrl(process.env.OBSERVABILITY_WEBHOOK_URL?.trim());
  if (!webhookUrl) return;

  const alertKey = `${event.event}:${event.operation}:${event.status}`;
  const now = Date.now();
  const lastSentAt = recentAlerts.get(alertKey) || 0;
  if (now - lastSentAt < ALERT_COOLDOWN_MS) return;
  recentAlerts.set(alertKey, now);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);
  const token = process.env.OBSERVABILITY_WEBHOOK_TOKEN?.trim();
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text: `[Portal ST] ${event.event} (${event.status}) en ${event.operation}`,
        event,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(JSON.stringify({
        level: "warn",
        event: "observability.webhook_failed",
        status: response.status,
      }));
    }
  } catch (alertError) {
    console.warn(JSON.stringify({
      level: "warn",
      event: "observability.webhook_failed",
      errorName: alertError instanceof Error ? alertError.name : "UnknownError",
    }));
  } finally {
    clearTimeout(timeout);
  }
}

export async function reportOperationalError(input: OperationalErrorInput) {
  const event = {
    timestamp: new Date().toISOString(),
    level: "error",
    service: "portal-pedidos",
    environment: environmentName(),
    deployment: deploymentReference(),
    event: input.event,
    operation: input.operation,
    dependency: input.dependency,
    status: input.status,
    route: input.route,
    requestId: input.requestId?.slice(0, 160) || undefined,
    ...errorDetails(input.error),
  };

  writeEvent(event);
  await sendAlert(event);
}

export function recordOperationalEvent(input: OperationalInfoInput) {
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "portal-pedidos",
    environment: environmentName(),
    deployment: deploymentReference(),
    event: input.event,
    operation: input.operation,
    dependency: input.dependency || "application",
    durationMs: input.durationMs,
    result: input.result,
  }));
}

import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { anonymizeExpiredOrderData } from "@/lib/privacy/order-retention";
import { recordOperationalEvent, reportOperationalError } from "@/lib/observability/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    await reportOperationalError({ event: "retention.cron_configuration_failed", operation: "orders.retention", dependency: "application", status: 503, error: new Error("CronSecretNotConfigured"), route: "/api/cron/data-retention" });
    return Response.json({ error: "La retención programada no está configurada." }, { status: 503, headers: noStoreHeaders });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const result = await anonymizeExpiredOrderData();
    recordOperationalEvent({
      event: "orders.retention_succeeded",
      operation: "orders.retention",
      dependency: "neon",
      result: "success",
      counts: { customers: result.customers, orders: result.orders, edits: result.edits },
    });
    return Response.json({ ok: true, ...result }, { headers: noStoreHeaders });
  } catch (error) {
    const unavailable = error instanceof DatabaseNotConfiguredError;
    await reportOperationalError({ event: unavailable ? "neon.unavailable" : "orders.retention_failed", operation: "orders.retention", dependency: "neon", status: unavailable ? 503 : 500, error, route: "/api/cron/data-retention" });
    return Response.json(
      { error: "No fue posible completar la retención programada." },
      { status: unavailable ? 503 : 500, headers: noStoreHeaders }
    );
  }
}

import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { deleteEligibleOrphanedBlobs } from "@/lib/blob/blob-lifecycle";
import { reportOperationalError } from "@/lib/observability/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    await reportOperationalError({ event: "blob.cron_configuration_failed", operation: "blob.cleanup.cron", dependency: "blob", status: 503, error: new Error("CronSecretNotConfigured"), route: "/api/cron/blob-cleanup" });
    return Response.json(
      { error: "La limpieza programada no está configurada." },
      { status: 503, headers: noStoreHeaders }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json(
      { error: "No autorizado." },
      { status: 401, headers: noStoreHeaders }
    );
  }

  try {
    const result = await deleteEligibleOrphanedBlobs();
    console.info("[blob-cleanup-cron] Limpieza completada.", {
      deleted: result.deleted,
    });
    return Response.json(
      { ok: true, deleted: result.deleted },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      await reportOperationalError({ event: "neon.unavailable", operation: "blob.cleanup.cron", dependency: "neon", status: 503, error, route: "/api/cron/blob-cleanup" });
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }
    await reportOperationalError({ event: "blob.cleanup_failed", operation: "blob.cleanup.cron", dependency: "blob", status: 500, error, route: "/api/cron/blob-cleanup" });
    return Response.json(
      { error: "No fue posible completar la limpieza programada." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

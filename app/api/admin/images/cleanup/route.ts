import {
  getKitchenSession,
  hasRole,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  deleteEligibleOrphanedBlobs,
  getBlobCleanupReport,
} from "@/lib/blob/blob-lifecycle";
import { reportOperationalError } from "@/lib/observability/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

async function isAdmin() {
  return hasRole(await getKitchenSession(), ["admin"]);
}

function configurationError(error: unknown) {
  return error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError;
}

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return Response.json({ error: "Necesitas permisos de administrador." }, { status: 403, headers: noStoreHeaders });
    }
    return Response.json({ report: await getBlobCleanupReport() }, { headers: noStoreHeaders });
  } catch (error) {
    if (configurationError(error)) {
      await reportOperationalError({ event: error instanceof DatabaseNotConfiguredError ? "neon.unavailable" : "auth.configuration_failed", operation: "blob.inventory", dependency: error instanceof DatabaseNotConfiguredError ? "neon" : "auth", status: 503, error, route: "/api/admin/images/cleanup" });
      return Response.json({ error: (error as Error).message }, { status: 503, headers: noStoreHeaders });
    }
    await reportOperationalError({ event: "blob.inventory_failed", operation: "blob.inventory", dependency: "blob", status: 500, error, route: "/api/admin/images/cleanup" });
    return Response.json({ error: "No fue posible consultar las imágenes de Blob." }, { status: 500, headers: noStoreHeaders });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isAdmin())) {
      return Response.json({ error: "Necesitas permisos de administrador." }, { status: 403, headers: noStoreHeaders });
    }
    const input = await request.json().catch(() => null) as { confirm?: boolean } | null;
    if (input?.confirm !== true) {
      return Response.json({ error: "Debes confirmar explícitamente la limpieza." }, { status: 400, headers: noStoreHeaders });
    }
    return Response.json(await deleteEligibleOrphanedBlobs(), { headers: noStoreHeaders });
  } catch (error) {
    if (configurationError(error)) {
      await reportOperationalError({ event: error instanceof DatabaseNotConfiguredError ? "neon.unavailable" : "auth.configuration_failed", operation: "blob.cleanup", dependency: error instanceof DatabaseNotConfiguredError ? "neon" : "auth", status: 503, error, route: "/api/admin/images/cleanup" });
      return Response.json({ error: (error as Error).message }, { status: 503, headers: noStoreHeaders });
    }
    await reportOperationalError({ event: "blob.cleanup_failed", operation: "blob.cleanup", dependency: "blob", status: 500, error, route: "/api/admin/images/cleanup" });
    return Response.json({ error: "No fue posible completar la limpieza de Blob." }, { status: 500, headers: noStoreHeaders });
  }
}

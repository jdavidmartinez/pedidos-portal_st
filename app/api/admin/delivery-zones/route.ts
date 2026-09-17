import { ZodError } from "zod";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { getKitchenSession, hasRole, KitchenAuthConfigError } from "@/lib/auth/kitchen-auth";
import { deliveryZoneRepository } from "@/lib/orders/delivery-zone-repository";
import { deliveryZoneConfigSchema } from "@/lib/orders/delivery-zone-schema";
import { reportRouteFailure } from "@/lib/observability/route-failure";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

async function requireAdmin() {
  return hasRole(await getKitchenSession(), ["admin"]);
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return Response.json({ error: "Necesitas permisos de administrador para configurar domicilios." }, { status: 403, headers: noStoreHeaders });
    }
    return Response.json({ zones: await deliveryZoneRepository.list() }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      await reportRouteFailure(error, "admin.delivery-zones.list", "/api/admin/delivery-zones", request);
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    await reportRouteFailure(error, "admin.delivery-zones.list", "/api/admin/delivery-zones", request);
    return Response.json({ error: "No fue posible consultar las zonas de domicilio." }, { status: 500, headers: noStoreHeaders });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return Response.json({ error: "Necesitas permisos de administrador para configurar domicilios." }, { status: 403, headers: noStoreHeaders });
    }
    const zone = deliveryZoneConfigSchema.parse(await request.json());
    return Response.json({ zone: await deliveryZoneRepository.update(zone) }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      await reportRouteFailure(error, "admin.delivery-zones.update", "/api/admin/delivery-zones", request);
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    if (error instanceof ZodError) {
      return Response.json({ error: "Los datos de la zona no son válidos.", issues: error.issues }, { status: 400, headers: noStoreHeaders });
    }
    await reportRouteFailure(error, "admin.delivery-zones.update", "/api/admin/delivery-zones", request);
    return Response.json({ error: "No fue posible guardar la zona de domicilio." }, { status: 500, headers: noStoreHeaders });
  }
}

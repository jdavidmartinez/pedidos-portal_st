import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { getKitchenSession, KitchenAuthConfigError } from "@/lib/auth/kitchen-auth";
import { deliveryZoneRepository } from "@/lib/orders/delivery-zone-repository";
import { reportRouteFailure } from "@/lib/observability/route-failure";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    if (!(await getKitchenSession())) {
      return Response.json(
        { error: "Debes iniciar sesión para consultar las zonas de domicilio." },
        { status: 401, headers: noStoreHeaders }
      );
    }

    return Response.json(
      { zones: await deliveryZoneRepository.list(true) },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      await reportRouteFailure(error, "delivery-zones.list", "/api/delivery-zones", request);
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }

    await reportRouteFailure(error, "delivery-zones.list", "/api/delivery-zones", request);
    return Response.json(
      { error: "No fue posible consultar las zonas de domicilio." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { campaignRepository } from "@/lib/campaigns/campaign-repository";
import { menuRepository } from "@/lib/menu/menu-repository";
import { getTodayInColombia } from "@/lib/orders/date-range";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return Response.json(
      {
        categories: await menuRepository.listActive(),
        campaign: await campaignRepository.getActiveForDate(getTodayInColombia()),
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    console.error("[menu] No fue posible consultar el catálogo:", error);
    return Response.json(
      { error: "No fue posible consultar el catálogo del menú." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

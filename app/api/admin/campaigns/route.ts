import { ZodError } from "zod";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  getKitchenSession,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";
import { campaignSchema } from "@/lib/campaigns/campaign-schema";
import {
  CampaignDateConflictError,
  campaignRepository,
} from "@/lib/campaigns/campaign-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    if (!(await getKitchenSession())) {
      return Response.json(
        { error: "Debes iniciar sesión para administrar las campañas." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    return Response.json(
      { campaigns: await campaignRepository.list() },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }

    console.error("[admin-campaigns] No fue posible consultar las campañas:", error);
    return Response.json(
      { error: "No fue posible consultar las campañas." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await getKitchenSession())) {
      return Response.json(
        { error: "Debes iniciar sesión para administrar las campañas." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    const input = campaignSchema.parse(await request.json());
    const campaign = await campaignRepository.create(input);
    return Response.json({ campaign }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Los datos de la campaña no son válidos.", issues: error.issues },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (error instanceof CampaignDateConflictError) {
      return Response.json({ error: error.message }, { status: 409, headers: noStoreHeaders });
    }

    console.error("[admin-campaigns] No fue posible crear la campaña:", error);
    return Response.json(
      { error: "No fue posible crear la campaña." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

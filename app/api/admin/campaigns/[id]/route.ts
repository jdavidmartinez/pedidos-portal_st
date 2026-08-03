import { ZodError } from "zod";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  getKitchenSession,
  hasRole,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";
import { campaignSchema } from "@/lib/campaigns/campaign-schema";
import {
  CampaignDateConflictError,
  CampaignNotFoundError,
  campaignRepository,
} from "@/lib/campaigns/campaign-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasRole(await getKitchenSession(), ["admin"])) {
      return Response.json(
        { error: "Necesitas permisos de administrador para administrar las campañas." },
        { status: 403, headers: noStoreHeaders },
      );
    }

    const { id } = await params;
    const input = campaignSchema.parse(await request.json());
    const campaign = await campaignRepository.update(id, input);
    return Response.json({ campaign }, { headers: noStoreHeaders });
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
    if (error instanceof CampaignNotFoundError) {
      return Response.json({ error: error.message }, { status: 404, headers: noStoreHeaders });
    }
    if (error instanceof CampaignDateConflictError) {
      return Response.json({ error: error.message }, { status: 409, headers: noStoreHeaders });
    }

    console.error("[admin-campaigns] No fue posible actualizar la campaña:", error);
    return Response.json(
      { error: "No fue posible actualizar la campaña." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasRole(await getKitchenSession(), ["admin"])) {
      return Response.json(
        { error: "Necesitas permisos de administrador para administrar las campañas." },
        { status: 403, headers: noStoreHeaders },
      );
    }

    const { id } = await params;
    await campaignRepository.delete(id);
    return new Response(null, { status: 204, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503, headers: noStoreHeaders });
    }
    if (error instanceof CampaignNotFoundError) {
      return Response.json({ error: error.message }, { status: 404, headers: noStoreHeaders });
    }

    console.error("[admin-campaigns] No fue posible borrar la campaña:", error);
    return Response.json(
      { error: "No fue posible borrar la campaña." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

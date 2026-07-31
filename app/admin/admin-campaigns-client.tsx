"use client";

import { useEffect, useState } from "react";

interface Campaign {
  id: string;
  name: string;
  discountPercent: number;
  startsOn: string;
  endsOn: string;
  active: boolean;
}

type CampaignDraft = Omit<Campaign, "id">;

const emptyDraft: CampaignDraft = {
  name: "",
  discountPercent: 5,
  startsOn: new Date().toISOString().slice(0, 10),
  endsOn: new Date().toISOString().slice(0, 10),
  active: true,
};

const fieldClass =
  "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]";

function campaignPayload(campaign: Campaign) {
  return {
    ...campaign,
    startsOn: campaign.startsOn.slice(0, 10),
    endsOn: campaign.endsOn.slice(0, 10),
    discountPercent: Number(campaign.discountPercent),
  };
}

export default function AdminCampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [draft, setDraft] = useState<CampaignDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadCampaigns() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/campaigns", { cache: "no-store" });
      const payload = await response.json() as { campaigns?: Campaign[]; error?: string };
      if (response.status === 401) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }
      if (!response.ok || !payload.campaigns) throw new Error(payload.error || "No fue posible cargar las campañas.");
      setCampaigns(payload.campaigns);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las campañas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadCampaigns(), 0);
    return () => window.clearTimeout(initialLoad);
  }, []);

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, discountPercent: Number(draft.discountPercent) }),
      });
      const payload = await response.json() as { campaign?: Campaign; error?: string };
      if (response.status === 401) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }
      if (!response.ok || !payload.campaign) throw new Error(payload.error || "No fue posible crear la campaña.");
      setCampaigns((current) => [payload.campaign!, ...current]);
      setDraft({ ...emptyDraft, startsOn: draft.startsOn, endsOn: draft.endsOn });
      setNotice("Campaña creada. Se aplicará únicamente dentro de sus fechas activas.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No fue posible crear la campaña.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaign(campaign: Campaign) {
    setSavingId(campaign.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignPayload(campaign)),
      });
      const payload = await response.json() as { campaign?: Campaign; error?: string };
      if (response.status === 401) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }
      if (!response.ok || !payload.campaign) throw new Error(payload.error || "No fue posible guardar la campaña.");
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? payload.campaign! : item));
      setNotice(`Campaña actualizada: ${payload.campaign.name}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No fue posible guardar la campaña.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!window.confirm(`¿Borrar la campaña "${campaign.name}"? Esta acción no se puede deshacer.`)) return;
    setSavingId(campaign.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (response.status === 401) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }
      if (!response.ok) throw new Error(payload.error || "No fue posible borrar la campaña.");
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      setNotice(`Campaña borrada: ${campaign.name}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No fue posible borrar la campaña.");
    } finally {
      setSavingId(null);
    }
  }

  function updateLocal(id: string, field: keyof CampaignDraft, value: string | number | boolean) {
    setCampaigns((current) => current.map((campaign) => campaign.id === id ? { ...campaign, [field]: value } : campaign));
  }

  return (
    <section className="mx-auto max-w-[1600px] px-4 pt-5">
      <div className="rounded-2xl border border-[#facc15]/40 bg-[#171717] p-4 shadow-xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#facc15]">Promociones</p>
            <h2 className="mt-1 text-xl font-black uppercase">Campañas de descuento</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/60">El precio de cada producto se mantiene igual; el descuento se refleja únicamente en el resumen y total del pedido. El domicilio no recibe descuento.</p>
          </div>
          <button type="button" onClick={() => void loadCampaigns()} className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:border-[#facc15] hover:text-[#facc15]">Actualizar</button>
        </div>

        {error && <div role="alert" className="mb-3 rounded-xl border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}
        {notice && <div role="status" className="mb-3 rounded-xl border border-emerald-400/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{notice}</div>}

        <form onSubmit={createCampaign} className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-black/25 p-3 md:grid-cols-[minmax(180px,1fr)_120px_150px_150px_auto] md:items-end">
          <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Nombre de campaña
            <input required minLength={2} maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ej. Martes de Portal" className={fieldClass} />
          </label>
          <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Descuento %
            <input required type="number" min="0" max="100" step="1" value={draft.discountPercent} onChange={(event) => setDraft({ ...draft, discountPercent: Number(event.target.value) })} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Desde
            <input required type="date" value={draft.startsOn} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Hasta
            <input required type="date" value={draft.endsOn} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })} className={fieldClass} />
          </label>
          <button type="submit" disabled={saving} className="rounded-lg border border-[#facc15] bg-[#d97706] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-50">{saving ? "Creando..." : "Crear campaña"}</button>
        </form>

        {loading ? <p className="py-5 text-sm text-white/55">Cargando campañas...</p> : campaigns.length === 0 ? <p className="rounded-xl border border-dashed border-white/20 px-4 py-5 text-sm text-white/55">Aún no hay campañas configuradas.</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className={`rounded-xl border p-3 ${campaign.active ? "border-emerald-400/50 bg-emerald-950/10" : "border-white/15 bg-black/20"}`}>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">Nombre
                    <input value={campaign.name} onChange={(event) => updateLocal(campaign.id, "name", event.target.value)} className={fieldClass} />
                  </label>
                  <div className="grid min-w-0 grid-cols-3 gap-2">
                    <label className="grid min-w-0 gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">%
                      <input type="number" min="0" max="100" value={campaign.discountPercent} onChange={(event) => updateLocal(campaign.id, "discountPercent", Number(event.target.value))} className={`${fieldClass} min-w-0`} />
                    </label>
                    <label className="grid min-w-0 gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">
                      <span>Desde</span>
                      <input type="date" value={campaign.startsOn.slice(0, 10)} onChange={(event) => updateLocal(campaign.id, "startsOn", event.target.value)} className={`${fieldClass} min-w-0 w-full px-2 text-xs sm:text-sm`} />
                    </label>
                    <label className="grid min-w-0 gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">
                      <span>Hasta</span>
                      <input type="date" value={campaign.endsOn.slice(0, 10)} onChange={(event) => updateLocal(campaign.id, "endsOn", event.target.value)} className={`${fieldClass} min-w-0 w-full px-2 text-xs sm:text-sm`} />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-white/75"><input type="checkbox" checked={campaign.active} onChange={(event) => updateLocal(campaign.id, "active", event.target.checked)} className="h-4 w-4 accent-[#facc15]" /> Campaña activa</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={savingId === campaign.id} onClick={() => void updateCampaign(campaign)} className="min-w-0 flex-1 rounded-lg border border-[#facc15] bg-[#d97706] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-50">{savingId === campaign.id ? "Guardando..." : "Guardar cambios"}</button>
                    <button type="button" disabled={savingId === campaign.id} onClick={() => void deleteCampaign(campaign)} className="rounded-lg border border-red-300/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-40">Borrar campaña</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

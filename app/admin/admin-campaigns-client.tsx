"use client";

/* eslint-disable @next/next/no-img-element -- Las vistas previas aceptan URLs administradas que no pueden limitarse a un host fijo. */

import { useEffect, useState } from "react";
import AdminImageUploader from "./admin-image-uploader";

interface Campaign {
  id: string;
  name: string;
  imageUrl: string;
  products: Array<{ id: string; name: string; imageUrl: string }>;
  discountPercent: number;
  startsOn: string;
  endsOn: string;
  active: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  active: boolean;
}

type CampaignDraft = Omit<Campaign, "id" | "products"> & { productIds: string[] };

const today = new Date().toISOString().slice(0, 10);
const emptyDraft: CampaignDraft = {
  name: "",
  imageUrl: "",
  productIds: [],
  discountPercent: 10,
  startsOn: today,
  endsOn: today,
  active: true,
};

const fieldClass =
  "min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]";

function campaignPayload(campaign: Campaign) {
  return {
    name: campaign.name,
    imageUrl: campaign.imageUrl,
    productIds: campaign.products.map((product) => product.id),
    discountPercent: Number(campaign.discountPercent),
    startsOn: campaign.startsOn.slice(0, 10),
    endsOn: campaign.endsOn.slice(0, 10),
    active: campaign.active,
  };
}

export default function AdminCampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [draft, setDraft] = useState<CampaignDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [campaignResponse, menuResponse] = await Promise.all([
        fetch("/api/admin/campaigns", { cache: "no-store" }),
        fetch("/api/admin/menu", { cache: "no-store" }),
      ]);
      if (campaignResponse.status === 401 || menuResponse.status === 401) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }
      const campaignPayload = await campaignResponse.json() as { campaigns?: Campaign[]; error?: string };
      const menuPayload = await menuResponse.json() as {
        categories?: Array<{ products: ProductOption[] }>;
        error?: string;
      };
      if (!campaignResponse.ok || !campaignPayload.campaigns) {
        throw new Error(campaignPayload.error || "No fue posible cargar las promociones.");
      }
      if (!menuResponse.ok || !menuPayload.categories) {
        throw new Error(menuPayload.error || "No fue posible cargar los productos.");
      }
      const nextProducts = menuPayload.categories.flatMap((category) => category.products);
      setCampaigns(campaignPayload.campaigns);
      setProducts(nextProducts);
      setDraft((current) => ({ ...current }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las promociones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadData(), 0);
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
      if (!response.ok || !payload.campaign) throw new Error(payload.error || "No fue posible crear la promoción.");
      setCampaigns((current) => [payload.campaign!, ...current]);
      setDraft({ ...emptyDraft, startsOn: draft.startsOn, endsOn: draft.endsOn });
      setNotice("Promoción creada. El popup aparecerá únicamente durante sus fechas activas.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No fue posible crear la promoción.");
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
      if (!response.ok || !payload.campaign) throw new Error(payload.error || "No fue posible guardar la promoción.");
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? payload.campaign! : item));
      setNotice(`Promoción actualizada: ${payload.campaign.name}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No fue posible guardar la promoción.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!window.confirm(`¿Borrar la promoción "${campaign.name}"?`)) return;
    setSavingId(campaign.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No fue posible borrar la promoción.");
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      setNotice(`Promoción borrada: ${campaign.name}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No fue posible borrar la promoción.");
    } finally {
      setSavingId(null);
    }
  }

  function updateLocal<K extends keyof Campaign>(id: string, field: K, value: Campaign[K]) {
    setCampaigns((current) => current.map((campaign) => campaign.id === id ? { ...campaign, [field]: value } : campaign));
  }

  return (
    <section className="mx-auto max-w-[1600px] px-4 pt-5">
      <div className="rounded-2xl border border-[#facc15]/40 bg-[#171717] p-4 shadow-xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#facc15]">Marketing</p>
            <h2 className="mt-1 text-xl font-black uppercase">Promociones del menú</h2>
            <p className="mt-1 max-w-3xl text-sm text-white/60">Las promociones se anuncian en un popup. No cambian precios, pedidos, facturas ni mensajes de WhatsApp; el restaurante aplica cualquier descuento manualmente.</p>
          </div>
          <button type="button" onClick={() => void loadData()} className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:border-[#facc15]">Actualizar</button>
        </div>

        {error && <div role="alert" className="mb-3 rounded-xl border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}
        {notice && <div role="status" className="mb-3 rounded-xl border border-emerald-400/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{notice}</div>}

        <form onSubmit={createCampaign} className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-black/25 p-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_100px_150px_150px_auto] xl:items-end">
          <Field label="Título"><input required minLength={2} maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ej. Festival de alitas" className={fieldClass} /></Field>
          <Field label="Productos"><ProductSelector products={products} selectedIds={draft.productIds} onChange={(productIds) => setDraft({ ...draft, productIds })} /></Field>
          <Field label="Descuento %"><input required type="number" min="1" max="100" value={draft.discountPercent} onChange={(event) => setDraft({ ...draft, discountPercent: Number(event.target.value) })} className={fieldClass} /></Field>
          <Field label="Desde"><input required type="date" value={draft.startsOn} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} className={fieldClass} /></Field>
          <Field label="Hasta"><input required type="date" value={draft.endsOn} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })} className={fieldClass} /></Field>
          <button type="submit" disabled={saving || draft.productIds.length === 0} className="rounded-lg border border-[#facc15] bg-[#d97706] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50">{saving ? "Creando..." : "Crear promoción"}</button>
          <div className="grid gap-2 md:col-span-2 xl:col-span-6">
            <Field label="Imagen propia del popup (opcional)"><input value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="Sube una imagen o pega una URL" className={fieldClass} /></Field>
            <div className="flex flex-wrap items-center gap-3">
              <AdminImageUploader folder="campaigns" onUploaded={(url) => setDraft((current) => ({ ...current, imageUrl: url }))} onError={setError} onNotice={setNotice} />
              <span className="text-xs font-normal normal-case tracking-normal text-white/45">JPEG, PNG o WebP · máximo 4 MB. Si queda vacía, se usa la imagen del primer producto.</span>
            </div>
            {draft.imageUrl && <img src={draft.imageUrl} alt="Vista previa de la promoción" className="h-28 w-full rounded-lg border border-white/10 object-cover" />}
          </div>
        </form>

        {loading ? <p className="py-5 text-sm text-white/55">Cargando promociones...</p> : campaigns.length === 0 ? <p className="rounded-xl border border-dashed border-white/20 px-4 py-5 text-sm text-white/55">Aún no hay promociones configuradas.</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className={`rounded-xl border p-3 ${campaign.active ? "border-emerald-400/50 bg-emerald-950/10" : "border-white/15 bg-black/20"}`}>
                <div className="grid gap-3">
                  <Field label="Título"><input value={campaign.name} onChange={(event) => updateLocal(campaign.id, "name", event.target.value)} className={fieldClass} /></Field>
                  <Field label="Imagen propia del popup"><input value={campaign.imageUrl} onChange={(event) => updateLocal(campaign.id, "imageUrl", event.target.value)} placeholder="Sin imagen propia" className={fieldClass} /></Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminImageUploader folder="campaigns" onUploaded={(url) => updateLocal(campaign.id, "imageUrl", url)} onError={setError} onNotice={setNotice} />
                    {campaign.imageUrl && <button type="button" onClick={() => updateLocal(campaign.id, "imageUrl", "")} className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase text-white/70">Usar imagen del producto</button>}
                  </div>
                  {campaign.imageUrl && <img src={campaign.imageUrl} alt={`Vista previa de ${campaign.name}`} className="h-28 w-full rounded-lg border border-white/10 object-cover" />}
                  <Field label="Productos"><ProductSelector products={products} selectedIds={campaign.products.map((product) => product.id)} onChange={(productIds) => updateLocal(campaign.id, "products", products.filter((product) => productIds.includes(product.id)).map((product) => ({ id: product.id, name: product.name, imageUrl: "" })))} /></Field>
                  {campaign.products.length === 0 && <p className="text-xs text-amber-200">Selecciona al menos un producto antes de reactivar esta promoción anterior.</p>}
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="%"><input type="number" min="1" max="100" value={campaign.discountPercent} onChange={(event) => updateLocal(campaign.id, "discountPercent", Number(event.target.value))} className={fieldClass} /></Field>
                    <Field label="Desde"><input type="date" value={campaign.startsOn.slice(0, 10)} onChange={(event) => updateLocal(campaign.id, "startsOn", event.target.value)} className={`${fieldClass} w-full px-2 text-xs`} /></Field>
                    <Field label="Hasta"><input type="date" value={campaign.endsOn.slice(0, 10)} onChange={(event) => updateLocal(campaign.id, "endsOn", event.target.value)} className={`${fieldClass} w-full px-2 text-xs`} /></Field>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-white/75"><input type="checkbox" checked={campaign.active} onChange={(event) => updateLocal(campaign.id, "active", event.target.checked)} className="h-4 w-4 accent-[#facc15]" /> Promoción activa</label>
                  <div className="flex gap-2">
                    <button type="button" disabled={savingId === campaign.id || campaign.products.length === 0} onClick={() => void updateCampaign(campaign)} className="flex-1 rounded-lg border border-[#facc15] bg-[#d97706] px-3 py-2 text-[10px] font-black uppercase text-white disabled:opacity-40">{savingId === campaign.id ? "Guardando..." : "Guardar"}</button>
                    <button type="button" disabled={savingId === campaign.id} onClick={() => void deleteCampaign(campaign)} className="rounded-lg border border-red-300/60 px-3 py-2 text-[10px] font-black uppercase text-red-200 disabled:opacity-40">Borrar</button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-1 text-[10px] font-black uppercase tracking-wider text-white/70"><span>{label}</span>{children}</div>;
}

function ProductSelector({ products, selectedIds, onChange }: { products: ProductOption[]; selectedIds: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/15 bg-black/40 p-2 normal-case tracking-normal">
      {products.map((product) => {
        const checked = selectedIds.includes(product.id);
        return (
          <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-white/80 hover:bg-white/5">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? selectedIds.filter((id) => id !== product.id) : [...selectedIds, product.id])}
              className="h-4 w-4 accent-[#facc15]"
            />
            <span>{product.name}{product.active ? "" : " (inactivo)"}</span>
          </label>
        );
      })}
      {products.length === 0 && <p className="px-2 py-1 text-xs text-white/45">No hay productos.</p>}
    </div>
  );
}

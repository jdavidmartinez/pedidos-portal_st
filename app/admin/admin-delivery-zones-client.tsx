"use client";

import { useEffect, useState } from "react";
import type { DeliveryZoneConfig } from "@/lib/orders/delivery-zones";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export default function AdminDeliveryZonesClient() {
  const [zones, setZones] = useState<DeliveryZoneConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/delivery-zones", { cache: "no-store" });
        const payload = (await response.json()) as { zones?: DeliveryZoneConfig[]; error?: string };
        if (!response.ok || !payload.zones) throw new Error(payload.error || "No fue posible cargar las zonas.");
        setZones(payload.zones);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las zonas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateLocal(code: DeliveryZoneConfig["code"], field: keyof DeliveryZoneConfig, value: string | number | boolean) {
    setZones((current) => current.map((zone) => zone.code === code ? { ...zone, [field]: value } : zone));
  }

  async function save(zone: DeliveryZoneConfig) {
    setSaving(zone.code);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/delivery-zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zone),
      });
      const payload = (await response.json()) as { zone?: DeliveryZoneConfig; error?: string };
      if (!response.ok || !payload.zone) throw new Error(payload.error || "No fue posible guardar la zona.");
      setZones((current) => current.map((item) => item.code === zone.code ? payload.zone! : item));
      setNotice(`${payload.zone.name} actualizada.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar la zona.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mx-auto max-w-[1600px] px-4 pt-5" aria-labelledby="delivery-zones-title">
      <div className="rounded-2xl border border-sky-300/30 bg-sky-300/[0.05] p-4 shadow-lg">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-200">Domicilios</p>
        <h2 id="delivery-zones-title" className="mt-1 text-xl font-black uppercase text-white">Zonas y tarifas</h2>
        <p className="mt-1 text-sm text-white/60">Estos valores se proponen en cocina. Cocina puede ajustar el valor al gestionar cada pedido.</p>

        {error && <p role="alert" className="mt-3 rounded-lg border border-red-400/40 bg-red-950/30 px-3 py-2 text-sm text-red-100">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-400/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">{notice}</p>}

        {loading ? <p className="mt-4 text-sm text-white/55">Cargando zonas...</p> : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {zones.map((zone) => (
              <article key={zone.code} className={`rounded-xl border bg-black/25 p-3 ${zone.active ? "border-white/15" : "border-red-300/30 opacity-75"}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{zone.code.replace("_", " ")}</p>
                <label className="mt-3 grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">Nombre
                  <input value={zone.name} maxLength={120} onChange={(event) => updateLocal(zone.code, "name", event.target.value)} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]" />
                </label>
                <label className="mt-3 grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">Tarifa sugerida
                  <input type="number" min="0" max="1000000" step="500" value={zone.fee} onChange={(event) => updateLocal(zone.code, "fee", Number(event.target.value))} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]" />
                </label>
                <p className="mt-1 text-xs text-[#facc15]">{formatCOP(zone.fee)}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-white/75"><input type="checkbox" checked={zone.active} onChange={(event) => updateLocal(zone.code, "active", event.target.checked)} className="h-4 w-4 accent-[#facc15]" /> Activa</label>
                  <button type="button" disabled={saving === zone.code} onClick={() => void save(zone)} className="rounded-lg border border-[#facc15] bg-[#d97706] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50">{saving === zone.code ? "Guardando..." : "Guardar"}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

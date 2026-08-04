"use client";

import { useState } from "react";

interface CleanupItem { pathname: string; url: string; size: number; uploadedAt: string; referenceCount: number; orphaned: boolean; eligibleForDeletion: boolean; orphanedDays: number; }
interface CleanupReport { retentionDays: number; generatedAt: string; totalManaged: number; referenced: number; orphaned: number; eligibleForDeletion: number; reclaimableBytes: number; items: CleanupItem[]; }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminBlobCleanup() {
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadReport() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/images/cleanup", { cache: "no-store" });
      const payload = await response.json() as { report?: CleanupReport; error?: string };
      if (response.status === 401 || response.status === 403) { window.location.replace("/cocina/login?next=/admin"); return; }
      if (!response.ok || !payload.report) throw new Error(payload.error || "No fue posible consultar Blob.");
      setReport(payload.report);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "No fue posible consultar Blob."); }
    finally { setLoading(false); }
  }

  async function cleanup() {
    if (!report || report.eligibleForDeletion === 0) return;
    if (!window.confirm(`Se eliminarán ${report.eligibleForDeletion} imágenes huérfanas con al menos ${report.retentionDays} días. Esta acción no se puede deshacer. ¿Continuar?`)) return;
    setCleaning(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/images/cleanup", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const payload = await response.json() as { deleted?: number; error?: string };
      if (!response.ok || typeof payload.deleted !== "number") throw new Error(payload.error || "No fue posible limpiar Blob.");
      setNotice(`Limpieza completada: ${payload.deleted} imágenes eliminadas.`);
      await loadReport();
    } catch (cleanupError) { setError(cleanupError instanceof Error ? cleanupError.message : "No fue posible limpiar Blob."); }
    finally { setCleaning(false); }
  }

  const orphanedItems = report?.items.filter((item) => item.orphaned) ?? [];
  return (
    <section className="mx-auto max-w-[1600px] px-4 pt-5">
      <div className="rounded-2xl border border-sky-400/30 bg-[#171717] p-4 shadow-xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[0.25em] text-sky-300">Almacenamiento</p><h2 className="mt-1 text-xl font-black uppercase">Limpieza de imágenes Blob</h2><p className="mt-1 max-w-3xl text-sm text-white/60">Las imágenes sin referencias se conservan 30 días. Las compartidas o vinculadas a productos y campañas nunca se pueden eliminar.</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void loadReport()} disabled={loading || cleaning} className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50">{loading ? "Consultando..." : "Revisar almacenamiento"}</button><button type="button" onClick={() => void cleanup()} disabled={cleaning || !report?.eligibleForDeletion} className="rounded-lg border border-red-300/50 bg-red-950/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-100 disabled:opacity-40">{cleaning ? "Eliminando..." : "Eliminar vencidas"}</button></div>
        </div>
        {error && <div role="alert" className="mt-3 rounded-xl border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}
        {notice && <div role="status" className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{notice}</div>}
        {report && <div className="mt-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{[["Administradas", report.totalManaged], ["Referenciadas", report.referenced], ["Huérfanas", report.orphaned], ["Eliminables", report.eligibleForDeletion], ["Espacio recuperable", formatBytes(report.reclaimableBytes)]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-black/25 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-white/45">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>)}</div>
          {orphanedItems.length > 0 ? <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-white/10">{orphanedItems.map((item) => <div key={item.url} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs last:border-b-0"><span className="min-w-0 truncate text-white/75">{item.pathname}</span><span className={item.eligibleForDeletion ? "font-bold text-red-200" : "text-amber-200"}>{item.orphanedDays} días huérfana · {formatBytes(item.size)} · {item.eligibleForDeletion ? "eliminable" : `en espera (${report.retentionDays} días)`}</span></div>)}</div> : <p className="mt-3 text-sm text-emerald-200">No hay imágenes huérfanas dentro de las carpetas administradas.</p>}
        </div>}
      </div>
    </section>
  );
}

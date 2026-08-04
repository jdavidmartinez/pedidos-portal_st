"use client";

import { useState } from "react";

export default function AdminImageUploader({
  folder = "menu-products",
  onUploaded,
  onError,
  onNotice,
}: {
  folder?: "menu-products" | "campaigns";
  onUploaded: (url: string) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;

    setUploading(true);
    onError("");
    onNotice("");

    try {
      const formData = new FormData();
      formData.append("image", image);
      formData.append("folder", folder);
      const response = await fetch("/api/admin/images", { method: "POST", body: formData });
      const payload = await response.json() as { url?: string; error?: string };

      if (response.status === 401 || response.status === 403) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "No fue posible subir la imagen.");
      }

      onUploaded(payload.url);
      onNotice("Imagen subida. Guarda los cambios para vincularla.");
    } catch (uploadError) {
      onError(uploadError instanceof Error ? uploadError.message : "No fue posible subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="inline-flex w-fit cursor-pointer items-center rounded-lg border border-emerald-400/50 bg-emerald-950/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-100 transition hover:bg-emerald-900/40 has-disabled:cursor-wait has-disabled:opacity-50">
      {uploading ? "Subiendo imagen..." : "Subir imagen a Vercel"}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(event) => void uploadImage(event)}
        className="sr-only"
      />
    </label>
  );
}

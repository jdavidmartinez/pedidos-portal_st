"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

export default function ChangePasswordClient({
  username,
  role,
}: {
  username: string;
  role: "admin" | "kitchen";
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmation }),
      });
      const payload = await response.json() as { error?: string };
      if (response.status === 401) {
        window.location.replace("/cocina/login");
        return;
      }
      if (!response.ok) throw new Error(payload.error || "No fue posible cambiar la contraseña.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setNotice("Contraseña actualizada. Las demás sesiones fueron cerradas.");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "No fue posible cambiar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0b] px-4 py-10 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-[#B03336]/70 bg-[#201E1E] p-8 shadow-2xl">
        <div className="flex items-center gap-4">
          <Image src="/images/Logo-Portal.png" width={64} height={64} alt="Logo de Portal ST" className="h-16 w-16 rounded-full object-cover" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#facc15]">Portal ST</p>
            <h1 className="mt-1 text-2xl font-black uppercase">Mi cuenta</h1>
            <p className="mt-1 text-xs text-white/55">{username} · {role === "admin" ? "Administrador" : "Cocina"}</p>
          </div>
        </div>

        <h2 className="mt-8 text-lg font-black uppercase">Cambiar contraseña</h2>
        <p className="mt-2 text-sm leading-6 text-white/60">Usa entre 12 y 128 caracteres e incluye mayúscula, minúscula, número y símbolo.</p>

        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <PasswordField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label="Nueva contraseña" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label="Confirmar nueva contraseña" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          {error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          {notice && <p role="status" className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">{notice}</p>}
          <button disabled={submitting} className="rounded-lg border border-[#facc15] bg-[#d97706] px-4 py-3 text-xs font-black uppercase tracking-wider transition hover:brightness-110 disabled:opacity-50">
            {submitting ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>

        <a href={role === "admin" ? "/admin" : "/cocina"} className="mt-5 block text-center text-xs font-bold uppercase tracking-wider text-white/60 hover:text-[#facc15]">Volver</a>
      </section>
    </main>
  );
}

function PasswordField({ label, value, onChange, autoComplete }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
      {label}
      <input type="password" autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} required maxLength={256} className="rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-base normal-case tracking-normal text-white outline-none focus:border-[#facc15]" />
    </label>
  );
}

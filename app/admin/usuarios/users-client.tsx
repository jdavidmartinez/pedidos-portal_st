"use client";

import { FormEvent, useEffect, useState } from "react";

interface UserSummary {
  id: string;
  username: string;
  role: "admin" | "kitchen";
  active: boolean;
  createdAt: string;
}

export default function AdminUsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void fetch("/api/admin/users", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { users?: UserSummary[]; error?: string };
        if (response.status === 401) {
          window.location.replace("/cocina/login?next=/admin");
          return;
        }
        if (!response.ok || !payload.users) throw new Error(payload.error || "No fue posible cargar los usuarios.");
        setUsers(payload.users);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los usuarios."))
      .finally(() => setLoading(false));
  }, []);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${selected.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmation }),
      });
      const payload = await response.json() as { error?: string; currentSessionRevoked?: boolean };
      if (!response.ok) throw new Error(payload.error || "No fue posible restablecer la contraseña.");
      if (payload.currentSessionRevoked) {
        window.location.replace("/cocina/login");
        return;
      }
      setNotice(`Contraseña restablecida para ${selected.username}. Sus sesiones fueron cerradas.`);
      setSelected(null);
      setNewPassword("");
      setConfirmation("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "No fue posible restablecer la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#facc15]">Administración</p>
            <h1 className="mt-1 text-3xl font-black uppercase">Usuarios</h1>
            <p className="mt-2 text-sm text-white/55">Restablece contraseñas y cierra todas las sesiones del usuario.</p>
          </div>
          <div className="flex gap-2">
            <a href="/cuenta" className="rounded-lg border border-white/20 px-4 py-2 text-xs font-black uppercase text-white/75 hover:border-[#facc15]">Mi cuenta</a>
            <a href="/admin" className="rounded-lg border border-[#facc15]/60 px-4 py-2 text-xs font-black uppercase text-[#facc15]">Volver al menú</a>
          </div>
        </div>

        {error && <p role="alert" className="mt-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#171717]">
          {loading ? <p className="p-6 text-white/55">Cargando usuarios...</p> : users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 last:border-0">
              <div>
                <p className="font-black">{user.username} {user.id === currentUserId && <span className="text-xs text-[#facc15]">(tú)</span>}</p>
                <p className="mt-1 text-xs text-white/50">{user.role === "admin" ? "Administrador" : "Cocina"} · {user.active ? "Activo" : "Inactivo"}</p>
              </div>
              <button type="button" onClick={() => { setSelected(user); setNewPassword(""); setConfirmation(""); setError(""); setNotice(""); }} className="rounded-lg border border-[#facc15]/60 px-4 py-2 text-xs font-black uppercase text-[#facc15] hover:bg-[#facc15]/10">Restablecer contraseña</button>
            </div>
          ))}
        </section>

        {selected && (
          <form onSubmit={resetPassword} className="mt-6 rounded-2xl border border-[#B03336]/60 bg-[#201E1E] p-6">
            <h2 className="text-xl font-black uppercase">Nueva contraseña para {selected.username}</h2>
            <p className="mt-2 text-sm text-white/60">Debe tener 12-128 caracteres, mayúscula, minúscula, número y símbolo.</p>
            {selected.id === currentUserId && <p className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">Restablecer tu propia contraseña cerrará esta sesión y tendrás que entrar nuevamente.</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PasswordInput label="Nueva contraseña" value={newPassword} onChange={setNewPassword} />
              <PasswordInput label="Confirmación" value={confirmation} onChange={setConfirmation} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-white/20 px-4 py-2 text-xs font-black uppercase">Cancelar</button>
              <button disabled={submitting} className="rounded-lg border border-[#facc15] bg-[#d97706] px-4 py-2 text-xs font-black uppercase disabled:opacity-50">{submitting ? "Guardando..." : "Restablecer"}</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function PasswordInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">{label}<input type="password" autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} required maxLength={128} className="rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-base normal-case tracking-normal outline-none focus:border-[#facc15]" /></label>;
}

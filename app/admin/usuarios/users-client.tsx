"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

interface UserSummary {
  id: string;
  username: string;
  role: "admin" | "kitchen";
  active: boolean;
  createdAt: string;
}

export default function AdminUsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"admin" | "kitchen">("kitchen");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const payload = await response.json() as { users?: UserSummary[]; error?: string };
    if (response.status === 401) {
      window.location.replace("/cocina/login?next=/admin");
      return;
    }
    if (!response.ok || !payload.users) throw new Error(payload.error || "No fue posible cargar los usuarios.");
    setUsers(payload.users);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadUsers()
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los usuarios."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadUsers]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          role,
          password,
          confirmation: passwordConfirmation,
        }),
      });
      const payload = await response.json() as { user?: UserSummary; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error || "No fue posible crear el usuario.");
      setUsers((current) => [...current, payload.user!].sort((a, b) => a.username.localeCompare(b.username)));
      setUsername("");
      setRole("kitchen");
      setPassword("");
      setPasswordConfirmation("");
      setNotice(`Usuario ${payload.user.username} creado con rol ${payload.user.role === "admin" ? "administrador" : "cocina"}.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No fue posible crear el usuario.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateLocal(id: string, field: "role" | "active", value: UserSummary[typeof field]) {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, [field]: value } : user));
  }

  async function saveAccess(user: UserSummary) {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: user.role, active: user.active }),
      });
      const payload = await response.json() as { user?: UserSummary; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error || "No fue posible actualizar el usuario.");
      setUsers((current) => current.map((item) => item.id === user.id ? payload.user! : item));
      setNotice(`Acceso actualizado para ${payload.user.username}. Sus sesiones anteriores fueron cerradas.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No fue posible actualizar el usuario.");
      void loadUsers().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  }

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
            <p className="mt-2 text-sm text-white/55">Crea usuarios, asigna roles, controla su acceso y restablece contraseñas.</p>
          </div>
          <div className="flex gap-2">
            <a href="/cuenta" className="rounded-lg border border-white/20 px-4 py-2 text-xs font-black uppercase text-white/75 hover:border-[#facc15]">Mi cuenta</a>
            <a href="/admin" className="rounded-lg border border-[#facc15]/60 px-4 py-2 text-xs font-black uppercase text-[#facc15]">Volver al menú</a>
          </div>
        </div>

        {error && <p role="alert" className="mt-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}

        <form onSubmit={createUser} className="mt-6 rounded-2xl border border-[#facc15]/40 bg-[#201E1E] p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#facc15]">Nuevo acceso</p>
            <h2 className="mt-1 text-xl font-black uppercase">Crear usuario</h2>
            <p className="mt-2 text-sm text-white/55">El usuario podrá iniciar sesión inmediatamente después de crearlo.</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={50} pattern="[a-zA-Z0-9._-]+" autoComplete="off" className="rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-base normal-case tracking-normal outline-none focus:border-[#facc15]" /></label>
            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">Rol<select value={role} onChange={(event) => setRole(event.target.value as "admin" | "kitchen")} className="rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-base normal-case tracking-normal outline-none focus:border-[#facc15]"><option value="kitchen">Cocina</option><option value="admin">Administrador</option></select></label>
            <PasswordInput label="Contraseña inicial" value={password} onChange={setPassword} />
            <PasswordInput label="Confirmación" value={passwordConfirmation} onChange={setPasswordConfirmation} />
          </div>
          <div className="mt-5 flex justify-end">
            <button disabled={submitting} className="rounded-lg border border-[#facc15] bg-[#d97706] px-5 py-3 text-xs font-black uppercase disabled:opacity-50">{submitting ? "Creando..." : "Crear usuario"}</button>
          </div>
        </form>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#171717]">
          {loading ? <p className="p-6 text-white/55">Cargando usuarios...</p> : users.map((user) => (
            <div key={user.id} className="grid gap-4 border-b border-white/10 px-5 py-5 last:border-0 lg:grid-cols-[minmax(180px,1fr)_160px_120px_auto] lg:items-end">
              <div className="self-center">
                <p className="font-black">{user.username} {user.id === currentUserId && <span className="text-xs text-[#facc15]">(tú)</span>}</p>
                <p className="mt-1 text-xs text-white/50">Creado el {new Date(user.createdAt).toLocaleDateString("es-CO")}</p>
              </div>
              <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/55">Rol<select aria-label={`Rol de ${user.username}`} value={user.role} disabled={user.id === currentUserId || submitting} onChange={(event) => updateLocal(user.id, "role", event.target.value as "admin" | "kitchen")} className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm normal-case tracking-normal text-white disabled:opacity-50"><option value="kitchen">Cocina</option><option value="admin">Administrador</option></select></label>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-white/75"><input type="checkbox" aria-label={`Usuario ${user.username} activo`} checked={user.active} disabled={user.id === currentUserId || submitting} onChange={(event) => updateLocal(user.id, "active", event.target.checked)} className="h-4 w-4 accent-[#facc15]" /> Activo</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={user.id === currentUserId || submitting} onClick={() => void saveAccess(user)} className="rounded-lg border border-emerald-400/50 px-3 py-2 text-[10px] font-black uppercase text-emerald-200 disabled:opacity-40">Guardar acceso</button>
                <button type="button" onClick={() => { setSelected(user); setNewPassword(""); setConfirmation(""); setError(""); setNotice(""); }} className="rounded-lg border border-[#facc15]/60 px-3 py-2 text-[10px] font-black uppercase text-[#facc15] hover:bg-[#facc15]/10">Contraseña</button>
              </div>
            </div>
          ))}
        </section>
        <p className="mt-3 text-xs text-white/45">Por seguridad no puedes modificar tu propio rol ni desactivar tu cuenta. Cambiar el acceso de otro usuario cierra todas sus sesiones.</p>

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

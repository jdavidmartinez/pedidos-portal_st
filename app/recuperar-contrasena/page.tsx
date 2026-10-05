"use client";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

export default function RecoveryPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // Synchronize with the browser-only fragment after hydration.
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(token ? "/api/auth/reset-password" : "/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token, password, confirmation } : { email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible procesar la solicitud.");
      setMessage(result.message); setDone(true); setPassword(""); setConfirmation("");
    } catch (err) { setError(err instanceof Error ? err.message : "No fue posible procesar la solicitud."); }
    finally { setBusy(false); }
  }
  const inputClass = "rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-white focus:border-[#facc15]";
  return <main className="flex min-h-screen items-center justify-center bg-[#0b0b0b] px-4 text-white">
    <section className="w-full max-w-md rounded-2xl border border-[#B03336]/70 bg-[#201E1E] p-8">
      <h1 className="text-2xl font-black">{token ? "Nueva contraseña" : "Recuperar contraseña"}</h1>
      <p className="my-5 text-sm text-white/70">{token ? "Usa entre 12 y 128 caracteres con mayúscula, minúscula, número y símbolo." : "Escribe el correo registrado para tu cuenta. El enlace será válido por 15 minutos."}</p>
      {!done && <form onSubmit={submit} className="grid gap-4">
        {token ? <>
          <label className="grid gap-2">Nueva contraseña<input className={inputClass} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label className="grid gap-2">Confirmar contraseña<input className={inputClass} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        </> : <label className="grid gap-2">Correo electrónico<input className={inputClass} type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} /></label>}
        <button disabled={busy} className="rounded-lg bg-[#d97706] px-4 py-3 font-bold disabled:opacity-50">{busy ? "Procesando..." : token ? "Guardar contraseña" : "Enviar enlace"}</button>
      </form>}
      {error && <p role="alert" className="mt-4 text-red-200">{error}</p>}
      {message && <p role="status" className="mt-4 text-green-200">{message}</p>}
      <Link className="mt-6 block text-sm text-[#facc15] underline" href="/cocina/login">Volver a iniciar sesión</Link>
      {token && !done && <Link className="mt-4 block text-sm underline" href="/recuperar-contrasena" onClick={() => { setToken(""); setError(""); }}>Solicitar otro enlace</Link>}
    </section>
  </main>;
}

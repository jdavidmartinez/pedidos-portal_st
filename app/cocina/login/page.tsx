"use client";

import Image from "next/image";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function KitchenLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0b0b0b]" />}>
      <KitchenLoginForm />
    </Suspense>
  );
}

function KitchenLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminLogin = searchParams.get("next") === "/admin";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as {
        error?: string;
        user?: { role: "admin" | "kitchen" };
      };

      if (!response.ok) {
        throw new Error(payload.error || "No fue posible iniciar sesión.");
      }

      router.replace(
        isAdminLogin && payload.user?.role === "admin"
          ? "/admin"
          : "/cocina"
      );
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No fue posible iniciar sesión."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0b] px-4 text-white">
      <section className="w-full max-w-md rounded-2xl border border-[#B03336]/70 bg-[#201E1E] p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-4">
          <Image
            src="/images/Logo-Portal.png"
            width={64}
            height={64}
            alt="Logo de Portal ST"
            loading="eager"
            className="h-16 w-16 rounded-full object-cover"
          />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#facc15]">
              Portal ST
            </p>
            <h1 className="mt-1 text-2xl font-black uppercase">
              {isAdminLogin ? "Acceso a administración" : "Acceso a cocina"}
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-white/65">
          {isAdminLogin
            ? "Ingresa tus credenciales de administrador para gestionar el menú, las campañas y los usuarios."
            : "Ingresa tus credenciales para administrar las órdenes."}
        </p>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
            Usuario
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-base normal-case tracking-normal text-white outline-none transition focus:border-[#facc15]"
              required
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-base normal-case tracking-normal text-white outline-none transition focus:border-[#facc15]"
              required
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg border border-[#facc15] bg-[#d97706] px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Validando..." : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}

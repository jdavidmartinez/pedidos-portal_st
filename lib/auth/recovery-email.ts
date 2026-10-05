import "server-only";

export function recoveryEmailConfig() {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_FROM?.trim();
  const origin = new URL(process.env.APP_ORIGIN || "");
  if (!key || !from || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/" ||
    (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origin.protocol === "http:" && origin.hostname === "localhost"))) {
    throw new Error("PasswordRecoveryNotConfigured");
  }
  return { key, from, origin: origin.origin };
}

export async function sendRecoveryEmail(email: string, token: string) {
  const { key, from, origin } = recoveryEmailConfig();
  // Fragment keeps the secret out of access logs and referrer headers.
  const link = `${origin}/recuperar-contrasena#token=${token}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `password-reset/${token}` },
    body: JSON.stringify({ from, to: [email], subject: "Recuperar contraseña · Portal ST",
      text: `Para cambiar tu contraseña abre este enlace (válido por 15 minutos):\n${link}\nSi no lo solicitaste, ignora este correo.` }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("PasswordRecoveryEmailFailed");
}

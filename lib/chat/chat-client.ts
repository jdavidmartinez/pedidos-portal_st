import { boundedChatHistory, CHAT_MESSAGE_MAX_CHARS, type ChatMessage } from "./chat-policy";

export async function requestMenuChat(message: string, history: ChatMessage[]) {
  let response: Response;
  const text = message.slice(0, CHAT_MESSAGE_MAX_CHARS);
  try {
    response = await fetch("/api/chat-menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajeUsuario: text, historial: boundedChatHistory(history, text) }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await response.json() as { respuesta?: unknown; error?: unknown };
    if (!response.ok || typeof data.respuesta !== "string" || !data.respuesta.trim()) {
      return typeof data.error === "string" ? data.error : "El asistente no está disponible. Puedes continuar con tu pedido sin el asistente.";
    }
    return data.respuesta;
  } catch {
    return "No fue posible contactar al asistente. Puedes intentar nuevamente o continuar con tu pedido sin el asistente.";
  }
}

export const CHAT_MESSAGE_MAX_CHARS = 8000;
export const CHAT_HISTORY_MESSAGE_MAX_CHARS = 4000;
export const CHAT_HISTORY_MAX_MESSAGES = 12;
export const CHAT_TOTAL_MAX_CHARS = 16000;
export const GEMINI_TIMEOUT_MS = 15000;

export interface ChatMessage { role: "user" | "bot"; text: string }

export function boundedChatHistory(history: ChatMessage[], message: string) {
  let remaining = CHAT_TOTAL_MAX_CHARS - message.length;
  const result: ChatMessage[] = [];
  for (const item of history.slice(-CHAT_HISTORY_MAX_MESSAGES).reverse()) {
    const text = item.text.slice(0, CHAT_HISTORY_MESSAGE_MAX_CHARS);
    if (text.length > remaining) break;
    result.unshift({ role: item.role, text });
    remaining -= text.length;
  }
  return result;
}

import { z } from "zod";
import { CHAT_MESSAGE_MAX_CHARS, CHAT_HISTORY_MESSAGE_MAX_CHARS, CHAT_HISTORY_MAX_MESSAGES, CHAT_TOTAL_MAX_CHARS } from "./chat-policy";

export const chatSchema = z.object({
  mensajeUsuario: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_CHARS),
  historial: z.array(z.object({
    role: z.enum(["user", "bot"]),
    text: z.string().min(1).max(CHAT_HISTORY_MESSAGE_MAX_CHARS),
  })).max(CHAT_HISTORY_MAX_MESSAGES).default([]),
}).refine(value => value.mensajeUsuario.length + value.historial.reduce((sum, item) => sum + item.text.length, 0) <= CHAT_TOTAL_MAX_CHARS);

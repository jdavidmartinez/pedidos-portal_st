import { ZodError } from "zod";
import { consumePublicRateLimit } from "@/lib/http/public-rate-limit";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { RequestError, requestErrorResponse } from "@/lib/http/request-error";
import { chatSchema } from "@/lib/chat/chat-schema";
import { GEMINI_TIMEOUT_MS } from "@/lib/chat/chat-policy";

import { NextResponse } from 'next/server';
import { menuRepository } from '@/lib/menu/menu-repository';
import { buildGeminiMenuContext } from '@/lib/menu/gemini-menu-context';
import { reportOperationalError } from '@/lib/observability/server';

export const runtime = "nodejs";
const noStoreHeaders = { "Cache-Control": "no-store" };

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export async function POST(request: Request) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await consumePublicRateLimit("chat", request);
    const { mensajeUsuario, historial } = chatSchema.parse(await readBoundedJson(request));
    const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!GEMINI_API_KEY) {
      const error = new Error("GeminiNotConfigured");
      await reportOperationalError({ event: "gemini.configuration_failed", operation: "gemini.generate", dependency: "gemini", status: 503, error, route: "/api/chat-menu" });
      return NextResponse.json({ error: "El asistente no está disponible temporalmente." }, { status: 503, headers: noStoreHeaders });
    }

    const catalog = await menuRepository.listActive();
    const contextoMenu = buildGeminiMenuContext(catalog);

    const systemInstruction = `
    Eres el asistente virtual interno de la app web de 'Portal ST'. Tu objetivo es procesar el pedido que el usuario seleccionó en la interfaz.
    Menú oficial actualizado desde el catálogo de la aplicación:
    ${contextoMenu}
    
    Instrucciones:
    - Habla en español, de forma muy cordial, breve y profesional.
    - Recomienda y cotiza únicamente productos y presentaciones incluidos en el menú oficial anterior.
    - Usa siempre el precio individual o combo indicado en el menú oficial, según la presentación elegida.
    - El primer mensaje que recibirás será la lista de platos que el usuario escogió con los botones. Confírmale que los tienes anotados, calcula el valor total y pregúntale amablemente si desea agregar algo más o proceder con el envío a la cocina.
    `;

    // Estructuración del payload para la API de Gemini
    const contents = [
      { parts: [{ text: systemInstruction }] },
      ...historial.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      })),
      { role: 'user', parts: [{ text: mensajeUsuario }] }
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } } }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw Object.assign(new Error("GeminiRequestFailed"), {
        code: `HTTP_${response.status}`,
      });
    }

    const data = await response.json() as GeminiResponse;
    const respuestaIA = data.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, experimenté un inconveniente al procesar la solicitud.";

    return NextResponse.json({ respuesta: respuestaIA }, { headers: noStoreHeaders });

  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof RequestError) return requestErrorResponse(error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "El mensaje o historial excede los límites permitidos o tiene un formato inválido." }, { status: 400, headers: noStoreHeaders });
    }
    const status = controller.signal.aborted ? 504 : 502;
    await reportOperationalError({ event: controller.signal.aborted ? "gemini.request_timeout" : "gemini.request_failed", operation: "gemini.generate", dependency: "gemini", status, error, route: "/api/chat-menu", requestId: request.headers.get("x-vercel-id") });
    return NextResponse.json({ error: controller.signal.aborted
      ? "El asistente tardó demasiado. Puedes intentar nuevamente o continuar con tu pedido sin el asistente."
      : "No fue posible consultar el asistente. Puedes continuar con tu pedido sin el asistente." }, { status, headers: noStoreHeaders });
  } finally {
    clearTimeout(timeout);
  }
}

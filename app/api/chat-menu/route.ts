import { NextResponse } from 'next/server';
import { menuRepository } from '@/lib/menu/menu-repository';
import { reportOperationalError } from '@/lib/observability/server';

interface MenuMessage {
  role: 'user' | 'bot';
  text: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      mensajeUsuario?: unknown;
      historial?: unknown;
    };
    const mensajeUsuario =
      typeof payload.mensajeUsuario === 'string' ? payload.mensajeUsuario : '';
    const historial = Array.isArray(payload.historial)
      ? payload.historial.filter(
          (message): message is MenuMessage =>
            typeof message === 'object' &&
            message !== null &&
            ('role' in message) &&
            (message.role === 'user' || message.role === 'bot') &&
            ('text' in message) &&
            typeof message.text === 'string'
        )
      : [];
    const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!GEMINI_API_KEY) {
      const error = new Error("GeminiNotConfigured");
      await reportOperationalError({ event: "gemini.configuration_failed", operation: "gemini.generate", dependency: "gemini", status: 503, error, route: "/api/chat-menu" });
      return NextResponse.json({ error: "El asistente no está disponible temporalmente." }, { status: 503 });
    }

    const catalog = await menuRepository.listActive();
    const contextoMenu = catalog
      .flatMap((category) => category.products.map((product) => {
        const combo = product.comboPrice === null
          ? ''
          : `, Combo $${product.comboPrice.toLocaleString('es-CO')} COP`;
        return `- ${product.name}: Individual $${product.individualPrice.toLocaleString('es-CO')} COP${combo}.`;
      }))
      .join('\n');

    const systemInstruction = `
    Eres el asistente virtual interno de la app web de 'Portal ST'. Tu objetivo es procesar el pedido que el usuario seleccionó en la interfaz.
    Menú oficial actualizado desde el catálogo: ${contextoMenu}
    
    Instrucciones:
    - Habla en español, de forma muy cordial, breve y profesional.
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
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!response.ok) {
      throw Object.assign(new Error("GeminiRequestFailed"), {
        code: `HTTP_${response.status}`,
      });
    }

    const data = await response.json() as GeminiResponse;
    const respuestaIA = data.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, experimenté un inconveniente al procesar la solicitud.";

    return NextResponse.json({ respuesta: respuestaIA });

  } catch (error: unknown) {
    await reportOperationalError({ event: "gemini.request_failed", operation: "gemini.generate", dependency: "gemini", status: 500, error, route: "/api/chat-menu", requestId: request.headers.get("x-vercel-id") });
    return NextResponse.json({ error: "No fue posible consultar el asistente." }, { status: 500 });
  }
}

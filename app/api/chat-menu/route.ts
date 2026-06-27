import { NextResponse } from 'next/server';

const CONTEXTO_MENU = `
MENU PORTAL ST:
- HAMBURGUESA PORTAL: Individual $18,000 COP, Combo $27,800 COP.
- HAMBURGUESA PORTAZO: Individual $28,000 COP, Combo $37,800 COP.
- HAMBURGUESA RANCHERA: Individual $22,500 COP, Combo $32,300 COP.
- AREPA BURGUER: Individual $19,000 COP, Combo $28,800 COP.
- PERRO PORTAL: Individual $14,500 COP, Combo $24,300 COP.
- SALCHIPAPA PORTAL: Individual $24,500 COP.
`;

export async function POST(request: Request) {
  try {
    const { mensajeUsuario, historial } = await request.json();
    const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Falta la API Key en las variables de entorno." }, { status: 500 });
    }

    const systemInstruction = `
    Eres el asistente virtual interno de la app web de 'Portal ST'. Tu objetivo es procesar el pedido que el usuario seleccionó en la interfaz.
    Menú oficial: ${CONTEXTO_MENU}
    
    Instrucciones:
    - Habla en español, de forma muy cordial, breve y profesional.
    - El primer mensaje que recibirás será la lista de platos que el usuario escogió con los botones. Confírmale que los tienes anotados, calcula el valor total y pregúntale amablemente si desea agregar algo más o proceder con el envío a la cocina.
    `;

    // Estructuración del payload para la API de Gemini
    const contents = [
      { parts: [{ text: systemInstruction }] },
      ...historial.map((msg: any) => ({
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

    const data = await response.json();
    const respuestaIA = data.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, experimenté un inconveniente al procesar la solicitud.";

    return NextResponse.json({ respuesta: respuestaIA });

  } catch (error: any) {
    console.error("❌ Error en la ruta de la API:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
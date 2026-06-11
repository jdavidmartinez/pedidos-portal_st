import { NextResponse } from 'next/server';

// 1. VALIDACIÓN GENERAL DEL WEBHOOK (Meta usa GET para activar el puente)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = "portal_st_token_secreto_2026";

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado con éxito por Meta en GET");
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// 2. RECEPCIÓN DE MENSAJES REALES (Meta usa POST para enviar el JSON de WhatsApp)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Imprime TODO el JSON de Meta directamente en tus logs de Vercel
    console.log("📦 JSON de Meta Recibido:", JSON.stringify(body));

    // Extracción ultra-segura basada estrictamente en tu JSON real
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (message) {
      const customerPhone = message.from;         // "573213166885"
      const customerMessage = message.text?.body;   // "Hola"
      const customerName = change?.contacts?.[0]?.profile?.name || "Cliente"; // "JD"

      console.log(`📩 ¡Mensaje Extraído! -> De: ${customerName} (${customerPhone}) | Mensaje: "${customerMessage}"`);

      // Variables de entorno guardadas en Vercel
      const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1208835768972526";
      const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

      if (!WHATSAPP_TOKEN) {
        console.error("❌ Error interno: WHATSAPP_TOKEN no está definido en Vercel");
        return NextResponse.json({ error: "Missing token" }, { status: 500 });
      }

      if (customerMessage) {
        // Respuesta provisional del Bot antes de enganchar Gemini
        const textoRespuesta = `🤖 ¡Hola ${customerName}! Tu backend en Vercel recibió tu mensaje de prueba: "${customerMessage}". El puente está listo.`;

        const urlMeta = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;

        const respuestaMeta = await fetch(urlMeta, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: customerPhone,
            type: "text",
            text: { preview_url: false, body: textoRespuesta }
          })
        });

        const resultadoMeta = await respuestaMeta.json();
        console.log("🚀 Respuesta enviada de vuelta a Meta:", JSON.stringify(resultadoMeta));
      }
    }

    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error) {
    console.error("❌ Error crítico en el endpoint POST:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
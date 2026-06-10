import { NextResponse } from 'next/server';

// 1. ENDPOINT DE VALIDACIÓN (Para cuando configures la URL en Meta)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Este token lo inventas tú, por ejemplo: "portal_st_token_secreto_2026"
  const MY_VERIFY_TOKEN = "portal_st_token_secreto_2026";

  if (mode && token) {
    if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
      console.log('¡Webhook verificado con éxito por Meta!');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }
  return new Response('Bad Request', { status: 400 });
}

// 2. ENDPOINT DE RECEPCIÓN (Para recibir los chats del cliente en vivo)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Verificamos si es un mensaje de texto entrante de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message && message.type === 'text') {
        const fromNumber = message.from; // Número de teléfono del cliente
        const messageText = message.text.body; // El texto que escribió (ej: "quiero un combo")

        console.log(`Mensaje recibido de ${fromNumber}: ${messageText}`);

        // AQUÍ CONECTAREMOS TU CEREBRO GEMINI EN EL SIGUIENTE PASO
        // Para responder directamente al número usando la API de Meta
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Error procesando webhook de WhatsApp:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
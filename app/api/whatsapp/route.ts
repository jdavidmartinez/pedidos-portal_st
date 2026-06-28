import { NextResponse } from 'next/server';

let ultimoEventoRecibido: any = null;
let fechaRegistro: string = "Ninguno todavía";

// 1. Meta Validation Endpoint (GET) - Intact
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "portal_st_token_secreto_2026";
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({
    status: "Monitor de Webhook Activo",
    ultima_conexion_recibida: fechaRegistro,
    payload_recibido: ultimoEventoRecibido
  });
}

// 2. Transmission Endpoint (POST) - Verified & Corrected
export async function POST(request: Request) {
  try {
    const body = await request.json();

    ultimoEventoRecibido = body;
    fechaRegistro = new Date().toISOString();

    console.log("📥 Incoming checkout payload intercepted:", body);

    // Extract structural data sent by your custom HTML checkout form
    const customerPhone = body["Phone number"] || "N/A";
    const customerName = body["Name"] || "N/A";
    const customerAddress = body["Address"] || "N/A";
    const comanda = body["Comanda"] || "N/A";

    // Clean kitchen layout string construction
    const formattedKitchenTicket = `*--- KITCHEN ORDER COMMAND ---*\n*Phone number:* ${customerPhone}\n*Name:* ${customerName}\n*Address:* ${customerAddress}\n*Comanda:* ${comanda}\n-----------------------------`;

    // Meta Cloud API variables
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const targetPhone = "573213166885"; // Your mobile phone number

    if (!phoneNumberId || !accessToken) {
      console.error("⚠️ Configuration Error: Missing environment variables in .env.local");
      return NextResponse.json({ error: "Missing WhatsApp gateway credentials." }, { status: 500 });
    }

    // Dispatch payload to Meta
    const metaUrl = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;
    const responseMeta = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: targetPhone,
        type: "text",
        text: { body: formattedKitchenTicket }
      })
    });

    const dataMeta = await responseMeta.json();

    if (!responseMeta.ok) {
      console.error("❌ Meta Cloud API rejected the payload:", dataMeta);
      return NextResponse.json({ error: "Meta gateway rejected payload structure." }, { status: 500 });
    }

    console.log("🚀 Kitchen ticket routed to phone successfully.");
    return NextResponse.json({ success: true, metaResponse: dataMeta });

  } catch (error: any) {
    console.error("❌ Backend processing failure:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
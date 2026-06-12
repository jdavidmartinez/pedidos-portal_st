import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. Forzar los datos reales para la prueba
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1208835768972526";
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const MY_PHONE = "573213166885"; // Tu celular real

    if (!WHATSAPP_TOKEN) {
      return NextResponse.json({ 
        error: "❌ Error: WHATSAPP_TOKEN no está definido en las variables de Vercel." 
      }, { status: 500 });
    }

    console.log(`🤖 Lanzando prueba directa de salida... ID: ${PHONE_NUMBER_ID}`);

    const urlMeta = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;

    // 2. Intentar hablarle a la API de Meta
    const respuestaMeta = await fetch(urlMeta, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: MY_PHONE,
        type: "text",
        text: { preview_url: false, body: "🚀 ¡Prueba de fuego exitosa! Vercel se comunicó directamente con tu WhatsApp." }
      })
    });

    const resultadoMeta = await respuestaMeta.json();
    
    // Devolvemos el resultado exacto de Meta a la pantalla del navegador
    return NextResponse.json({
      status: "Petición enviada",
      meta_response: resultadoMeta
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
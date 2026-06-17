import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. Simulación del mensaje entrante del cliente
    // Modifica este texto para probar cómo reacciona la IA a diferentes peticiones
    const MENSAJE_SIMULADO = "Hola, me gustaría ver el menú de hamburguesas y saber los precios"; 

    // 2. Conexión con la API de Gemini
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    // Si no tienes la API Key configurada, el código te lo advertirá de inmediato
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: "Falta la variable de entorno GEMINI_API_KEY en Vercel." 
      }, { status: 500 });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Eres un bot de atención al cliente automatizado para un restaurante llamado 'Portal ST'. Responde de forma muy breve, cordial y profesional al siguiente mensaje del cliente: "${MENSAJE_SIMULADO}"` 
          }] 
        }]
      })
    });

    const geminiData = await geminiResponse.json();
    const respuestaIA = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Error al generar respuesta con Gemini.";

    // 3. Enviar la respuesta generada por Gemini a tu WhatsApp físico
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1208835768972526";
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const MY_PHONE = "573213166885";

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
        to: MY_PHONE,
        type: "text",
        text: { preview_url: false, body: respuestaIA }
      })
    });

    const resultadoMeta = await respuestaMeta.json();
    
    // Retornamos el diagnóstico completo en la pantalla del navegador
    return NextResponse.json({
      status: "Ciclo de simulación completado con éxito",
      prompt_enviado_a_ia: MENSAJE_SIMULADO,
      respuesta_generada_por_gemini: respuestaIA,
      meta_api_response: resultadoMeta
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
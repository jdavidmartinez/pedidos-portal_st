import { NextResponse } from 'next/server';

// Variable global en memoria para almacenar el último payload recibido de Meta
let ultimoEventoRecibido: any = null;
let fechaRegistro: string = "Ninguno todavía";

// 1. Endpoint de Monitoreo (GET): Carga esto en tu navegador para ver si llegó el POST
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Lógica de validación obligatoria de Meta (Se mantiene intacta)
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "portal_st_token_secreto_2026";
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  // Si se entra sin parámetros de Meta, actúa como panel de diagnóstico en el navegador
  return NextResponse.json({
    status: "Monitor de Webhook Activo",
    ultima_conexion_recibida: fechaRegistro,
    payload_recibido: ultimoEventoRecibido
  });
}

// 2. Endpoint Receptor (POST): Captura lo que envía Meta
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Guardamos el JSON completo y la hora exacta en las variables globales
    ultimoEventoRecibido = body;
    fechaRegistro = new Date().toISOString();

    console.log("📩 ¡POST de Meta detectado e interceptado con éxito!");

    // Respondemos inmediatamente con 200 OK a Meta para confirmar recepción
    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
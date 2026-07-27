import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { menuData } from '../../../data/menu'; // Leemos tu menú local

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Definimos el esquema estricto que la IA DEBE devolver obligatoriamente
const orderResponseSchema = z.object({
    // 1. Le damos una estructura clara al esquema para que Gemini sepa CÓMO llenar el JSON
    reply: z.string().describe("La respuesta conversacional amigable que se le mostrará al cliente."),
    isOrderComplete: z.boolean().describe("Cambiar a true solo cuando el cliente confirme explícitamente que finalizó su pedido."),
    extractedOrder: z.array(
      z.object({
        name: z.string().describe("Nombre del producto (ej. Hamburguesa Portal)"),
        quantity: z.number().describe("Cantidad solicitada"),
        isCombo: z.boolean().describe("true si lo quiere en combo, false si es individual"),
        beverage: z.string().optional().describe("Bebida elegida si es un combo (ej. Coca Cola)")
      })
    ).optional().describe("La lista acumulada de productos que el cliente lleva pedidos hasta el momento.")
  });
  
  export async function POST(req: Request) {
    try {
      const payload = await req.json() as { messageHistory?: unknown };
      const messageHistory = Array.isArray(payload.messageHistory)
        ? payload.messageHistory.filter(
            (message): message is ConversationMessage =>
              typeof message === 'object' &&
              message !== null &&
              ('role' in message) &&
              (message.role === 'user' || message.role === 'assistant') &&
              ('content' in message) &&
              typeof message.content === 'string'
          )
        : [];
  
      // 2. CREAMOS LA MEMORIA: Construimos el historial completo para pasárselo a la IA
      const conversationHistory = messageHistory
        .map((msg) => `${msg.role === 'user' ? 'Cliente' : 'Asistente'}: ${msg.content}`)
        .join('\n');
  
      const result = await generateObject({
        // Usamos la nueva clave del Default Gemini Project que creaste
        model: google('gemini-2.5-flash'), 
        schema: orderResponseSchema,
        system: `Eres el asistente virtual encargado de tomar pedidos en el restaurante "Portal St". Tu objetivo es procesar las órdenes de manera rápida y amable.
        
        Aquí tienes el menú oficial con sus productos, ingredientes y precios en combo o individuales:
        ${JSON.stringify(menuData, null, 2)}
        
        Reglas cruciales para el MVP:
        1. Si el cliente pide un producto que tiene opción de combo (hamburguesas, perros, sándwiches) pero no aclara si lo quiere en combo o individual, asume individual o pregúntale educadamente.
        2. Si pide un combo, SIEMPRE pregúntale qué bebida desea de la sección de bebidas o limonadas. Cuando te la diga, regístrala junto al producto.
        3. No dejes que el pedido se complete ('isOrderComplete': true) hasta que el cliente te diga textualmente algo como "Eso es todo", "No más", "Confirmar pedido", etc.
        4. Mapea y mantén el registro acumulado exacto de TODO lo que el usuario va pidiendo analizando todo el historial en 'extractedOrder'.`,
        // 3. PASAMOS LA MEMORIA: Ahora Gemini sabe perfectamente de qué venían hablando
        prompt: `Analiza la siguiente conversación acumulada y genera la respuesta estructurada correspondiente.\n\nHistorial de conversación:\n${conversationHistory}\n\nGenera la respuesta basándote en el contexto completo pero respondiendo al último mensaje del Cliente.`,
      });
  
      return Response.json(result.object);
    } catch (error) {
      console.error("Error en el agente de IA:", error);
      return Response.json({ error: "Ocurrió un error al procesar el pedido." }, { status: 500 });
    }
  }

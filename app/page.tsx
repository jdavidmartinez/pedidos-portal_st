'use client';

import { useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveOrder, setLiveOrder] = useState<any>(null);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    const updatedHistory = [...messages, userMessage];
    
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHistory: updatedHistory }),
      });

      const data = await response.json();
      
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      
      if (data.extractedOrder) {
        setLiveOrder({
          items: data.extractedOrder,
          isOrderComplete: data.isOrderComplete
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#121212] text-white flex flex-col md:flex-row p-4 gap-4 font-sans">
      
      {/* Columna Izquierda: El Chat del MVP */}
      <div className="flex-1 bg-[#1a1a1a] rounded-xl border border-zinc-800 flex flex-col h-[85vh] shadow-2xl">
        <div className="p-4 border-b border-zinc-800 bg-[#222]">
          <h1 className="text-xl font-bold text-[#e50e0f] tracking-wide">Portal St - IA Takeout Bot (MVP)</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Interactúa con el agente para armar tu orden</p>
        </div>

        {/* Zona de Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-center text-zinc-500 text-sm mt-10">Escribe algo como: "Hola, quiero un combo de hamburguesa portal"</p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[75%] p-3 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-white self-end rounded-br-none'
                  : 'bg-red-950/40 border border-red-900/30 text-zinc-100 self-start rounded-bl-none'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {loading && <div className="text-xs text-zinc-500 animate-pulse self-start pl-2">El agente está procesando...</div>}
        </div>

        {/* Formulario de Entrada */}
        <form onSubmit={sendMessage} className="p-3 border-t border-zinc-800 bg-[#161616] flex gap-2 rounded-b-xl">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pedido aquí..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-red-600 transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-[#e50e0f] hover:bg-red-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors"
            disabled={loading}
          >
            Enviar
          </button>
        </form>
      </div>

      {/* Columna Derecha: Consola de Datos en Vivo (JSON) */}
      <div className="w-full md:w-[380px] bg-[#161616] rounded-xl border border-zinc-800 p-4 flex flex-col h-[85vh]">
        <h2 className="text-sm font-bold uppercase text-zinc-400 tracking-wider mb-3">Extracción de Datos (JSON)</h2>
        <div className="flex-1 bg-zinc-950 rounded-lg p-3 font-mono text-xs overflow-auto text-green-400 border border-zinc-900">
          {liveOrder ? (
            <pre>{JSON.stringify(liveOrder, null, 2)}</pre>
          ) : (
            <span className="text-zinc-600 italic">Esperando que inicies la orden...</span>
          )}
        </div>
        {liveOrder?.isOrderComplete && (
          <div className="mt-3 bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-xs font-bold p-3 rounded-lg text-center animate-bounce">
            🎉 ¡PEDIDO COMPLETADO CON ÉXITO!
          </div>
        )}
      </div>

    </main>
  );
}
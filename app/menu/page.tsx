'use client';

import React, { useState } from 'react';
import { MENU_PORTAL, Producto } from './data';

interface Mensaje {
  role: 'user' | 'bot';
  text: string;
}

export default function LandingMenuPage() {
  const [categoriaActiva, setCategoriaActiva] = useState<string>(Object.keys(MENU_PORTAL)[0]);
  const [cantidades, setCantidades] = useState<{ [key: string]: number }>({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [inputUsuario, setInputUsuario] = useState('');
  const [cargando, setCargando] = useState(false);

  const cambiarCantidad = (nombre: string, incremento: number) => {
    setCantidades(prev => ({
      ...prev,
      [nombre]: Math.max(0, (prev[nombre] || 0) + incremento)
    }));
  };

  const iniciarOrdenConIA = async () => {
    setIsChatOpen(true);
    
    const seleccionados = Object.entries(cantidades)
      .filter(([_, qty]) => qty > 0)
      .map(([name, qty]) => `${qty}x ${name}`);

    if (seleccionados.length > 0) {
      const ordenInicial = `Hola, veo el menú y quiero ordenar estos productos:\n${seleccionados.join('\n')}.\n¿Me confirmas el total y tomamos el pedido?`;
      
      const nuevosMensajes = [{ 
        role: 'user', 
        text: `👋 ¡Hola! Me interesa ordenar esto desde el menú web:\n${seleccionados.join(', ')}` 
      } as Mensaje];
      
      setMensajes(nuevosMensajes);
      setCargando(true);

      try {
        const response = await fetch('/api/chat-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensajeUsuario: ordenInicial, historial: [] })
        });
        const data = await response.json();
        setMensajes([...nuevosMensajes, { role: 'bot', text: data.respuesta }]);
      } catch (err) {
        console.error("Error al conectar con la API de chat:", err);
      } finally {
        setCargando(false);
      }
    } else {
      if (mensajes.length === 0) {
        setMensajes([{ 
          role: 'bot', 
          text: '¡Hola! Bienvenido a Portal ST. No has seleccionado productos todavía en la pantalla, pero dime: ¿qué te gustaría comer hoy?' 
        }]);
      }
    }
  };

  const manejarEnvioManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUsuario.trim()) return;
    enviarMensajeServidor(inputUsuario);
    setInputUsuario('');
  };

  const enviarMensajeServidor = async (texto: string) => {
    const nuevosMensajes = [...mensajes, { role: 'user', text: texto } as Mensaje];
    setMensajes(nuevosMensajes);
    setCargando(true);

    try {
      const response = await fetch('/api/chat-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensajeUsuario: texto, historial: mensajes })
      });
      const data = await response.json();
      setMensajes([...nuevosMensajes, { role: 'bot', text: data.respuesta }]);
    } catch (err) {
      console.error("Error en la comunicación síncrona:", err);
    } finally {
      setCargando(false);
    }
  };

  const formatCOP = (value: number) => {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP', 
      minimumFractionDigits: 0 
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-stone-900 text-amber-50 font-sans pb-24 relative">
      
      {/* Banner Presentation */}
      <header className="relative bg-neutral-950 text-center py-16 px-4 border-b border-amber-600/20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000')] opacity-10 bg-cover bg-center"></div>
        <div className="relative">
          <h1 className="text-4xl font-black text-amber-500 uppercase tracking-wider">Portal ST</h1>
          <p className="mt-2 text-sm uppercase tracking-widest text-stone-400">Sabores Artesanales a la Parrilla</p>
        </div>
      </header>

      {/* 
        FIXED LAYOUT: Removed 'sticky top-0 z-40' to allow natural page scrolling.
        The navigation block now scrolls out of view naturally on mobile layouts.
      */}
      <nav className="relative bg-neutral-950/95 border-b border-stone-850 px-4 py-4 grid grid-cols-1 gap-2 sm:grid-cols-3 max-w-4xl mx-auto w-full">
        {Object.keys(MENU_PORTAL).map((cat) => (
          <button 
            key={cat} 
            onClick={() => setCategoriaActiva(cat)} 
            className={`w-full px-5 py-3 rounded-xl font-bold text-sm tracking-wide transition-all uppercase ${
              categoriaActiva === cat 
                ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/10' 
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Products Catalog Grid */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {MENU_PORTAL[categoriaActiva]?.map((plato: Producto, idx: number) => {
            const cantidadActual = cantidades[plato.nombre] || 0;
            return (
              <div key={idx} className="bg-neutral-950 rounded-2xl overflow-hidden border border-stone-800/60 flex flex-col justify-between shadow-lg">
                <div className="h-48 bg-stone-900">
                  <img src={plato.imagen} alt={plato.nombre} className="w-full h-full object-cover" />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-stone-100 uppercase tracking-wide">{plato.nombre}</h3>
                    <p className="mt-1 text-xs text-stone-400 font-light leading-relaxed">{plato.descripcion}</p>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-stone-900 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-stone-500 uppercase font-bold">Individual</span>
                      <span className="text-base font-black text-amber-500">{formatCOP(plato.precioIndividual)}</span>
                    </div>

                    <div className="flex items-center bg-stone-900 rounded-xl p-1 border border-stone-800 shadow-inner">
                      <button onClick={() => cambiarCantidad(plato.nombre, -1)} className="w-8 h-8 text-stone-400 hover:text-amber-500 font-bold transition-colors">-</button>
                      <span className="w-8 text-center font-black text-xs text-stone-100">{cantidadActual}</span>
                      <button onClick={() => cambiarCantidad(plato.nombre, 1)} className="w-8 h-8 text-stone-400 hover:text-amber-500 font-bold transition-colors">+</button>
                    </div>

                    {plato.precioCombo && (
                      <div className="flex flex-col text-right bg-stone-900/40 px-2.5 py-1 rounded-lg border border-stone-800">
                        <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">🍔🍟 Combo</span>
                        <span className="text-base font-black text-stone-100">{formatCOP(plato.precioCombo)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Action CTA Button */}
      <div className="fixed bottom-6 inset-x-4 z-40 text-center">
        <button 
          onClick={iniciarOrdenConIA}
          className="w-full max-w-md bg-gradient-to-r from-amber-600 to-amber-500 text-neutral-950 font-black py-4 rounded-2xl uppercase text-xs tracking-wider transition-all duration-300 transform hover:brightness-110 hover:scale-[1.02] hover:shadow-2xl hover:shadow-amber-500/20 active:scale-[0.98] shadow-xl"
        >
          🤖 Ordenar con Asistente AI
        </button>
      </div>

      {/* Interactive Chat Modal Panel */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-neutral-900 w-full sm:max-w-md h-[80vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl border border-stone-800 flex flex-col justify-between shadow-2xl overflow-hidden">
            
            <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-neutral-950">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="font-bold text-xs tracking-wider uppercase text-amber-500">Mesero Virtual ST</span>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-stone-400 hover:text-stone-100 text-xs font-bold uppercase tracking-wider bg-stone-800 px-3 py-1 rounded-lg transition-colors">Cerrar</button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-950/40">
              {mensajes.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-amber-500 text-neutral-950 font-semibold shadow-md' : 'bg-stone-800 text-stone-100 border border-stone-750'}`}>
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                </div>
              ))}
              {cargando && (
                <div className="text-left">
                  <span className="inline-block bg-stone-800/80 text-stone-400 text-xs px-3 py-1.5 rounded-full animate-pulse font-medium">
                    El asistente está analizando el menú...
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={manejarEnvioManual} className="p-3 border-t border-stone-800 bg-neutral-950 flex gap-2">
              <input 
                type="text" 
                value={inputUsuario} 
                onChange={(e) => setInputUsuario(e.target.value)}
                placeholder="Escribe tu mensaje o confirma..." 
                className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-600"
              />
              <button type="submit" className="bg-amber-500 text-neutral-950 font-black px-5 rounded-xl text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors">Enviar</button>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
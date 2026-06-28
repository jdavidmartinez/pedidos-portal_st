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

  // Controladores de estado del flujo de orden y formulario
  const [isConfirmedByAI, setIsConfirmedByAI] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);

  const cambiarCantidad = (nombre: string, incremento: number) => {
    setCantidades(prev => ({
      ...prev,
      [nombre]: Math.max(0, (prev[nombre] || 0) + incremento)
    }));
  };

  // PASO 1: Abre el modal e inicia el diálogo con Gemini en español incluyendo la regla del domicilio
  const iniciarOrdenConIA = async () => {
    setIsChatOpen(true);
    setIsConfirmedByAI(false);
    setOrderSubmitted(false);
    
    const seleccionados = Object.entries(cantidades)
      .filter(([_, qty]) => qty > 0)
      .map(([name, qty]) => `${qty}x ${name}`);

    if (seleccionados.length > 0) {
      // Prompt del sistema enviado a la IA para indicarle el idioma y la advertencia del domicilio
      const ordenInicial = `Hola, quiero ordenar los siguientes productos del menú:\n${seleccionados.join('\n')}.\nPor favor calcula el precio total y confirma mi pedido en español. Recuerda informarme explícitamente que el costo NO incluye el domicilio, y que el valor del envío será confirmado por el restaurante al enviar el pedido.`;
      
      const nuevosMensajes = [{ 
        role: 'user', 
        text: `👋 ¡Hola! Quiero revisar este pedido:\n${seleccionados.join(', ')}` 
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
        console.error("Error al comunicarse con la API de Gemini:", err);
      } finally {
        setCargando(false);
      }
    } else {
      setMensajes([{ 
        role: 'bot', 
        text: '¡Hola! Tu canasta está vacía. Por favor, selecciona algunos productos del menú antes de iniciar el proceso de compra.' 
      }]);
    }
  };

  // PASO 2: Permite la conversación manual con la IA en español
  const manejarEnvioManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUsuario.trim() || cargando) return;

    const texto = inputUsuario;
    setInputUsuario('');
    
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
      console.error("Error en el flujo de conversación:", err);
    } finally {
      setCargando(false);
    }
  };

  // PASO 3: Envía los datos del formulario de entrega hacia el endpoint de WhatsApp
  const enviarFormularioAWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !deliveryAddress.trim() || !phoneNumber.trim()) return;

    setCargando(true);

    const comanda = Object.entries(cantidades)
      .filter(([_, qty]) => qty > 0)
      .map(([name, qty]) => `${qty}x ${name}`);

    const kitchenOrderTicket = {
      "Phone number": phoneNumber,
      "Name": customerName,
      "Address": deliveryAddress,
      "Comanda": comanda.join(', ')
    };

    try {
      const response = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kitchenOrderTicket)
      });

      if (response.ok) {
        setOrderSubmitted(true);
        setMensajes(prev => [...prev, { role: 'bot', text: '¡Excelente! Tu pedido ha sido procesado y enviado directamente al canal de la cocina por WhatsApp.' }]);
      } else {
        throw new Error("Error en la respuesta del servidor de WhatsApp.");
      }
    } catch (err) {
      console.error("Error al enrutar a WhatsApp:", err);
    } finally {
      setCargando(false);
    }
  };

  const formatCOP = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="min-h-screen bg-stone-900 text-amber-50 font-sans pb-24 relative">
      
      {/* Banner de Presentación */}
      <header className="relative bg-neutral-950 text-center py-16 px-4 border-b border-amber-600/20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000')] opacity-10 bg-cover bg-center"></div>
        <h1 className="text-4xl font-black text-amber-500 uppercase tracking-wider">Portal ST</h1>
        <p className="mt-2 text-sm uppercase tracking-widest text-stone-400">Sabores Artesanales a la Parrilla</p>
      </header>

      {/* Navegación por Categorías */}
      <nav className="relative bg-neutral-950/95 border-b border-stone-850 px-4 py-4 grid grid-cols-1 gap-2 sm:grid-cols-3 max-w-4xl mx-auto w-full">
        {Object.keys(MENU_PORTAL).map((cat) => (
          <button 
            key={cat} 
            onClick={() => setCategoriaActiva(cat)} 
            className={`w-full px-5 py-3 rounded-xl font-bold text-sm tracking-wide transition-all uppercase ${
              categoriaActiva === cat ? 'bg-amber-500 text-neutral-950 shadow-md' : 'bg-stone-800 text-stone-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Catálogo de Productos */}
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
                    <div className="flex items-center bg-stone-900 rounded-xl p-1 border border-stone-800">
                      <button onClick={() => cambiarCantidad(plato.nombre, -1)} className="w-8 h-8 text-stone-400 hover:text-amber-500 font-bold">-</button>
                      <span className="w-8 text-center font-black text-xs text-stone-100">{cantidadActual}</span>
                      <button onClick={() => cambiarCantidad(plato.nombre, 1)} className="w-8 h-8 text-stone-400 hover:text-amber-500 font-bold">+</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Botón Flotante de Compra */}
      <div className="fixed bottom-6 inset-x-4 z-40 text-center">
        <button 
          onClick={iniciarOrdenConIA}
          className="w-full max-w-md bg-gradient-to-r from-amber-600 to-amber-500 text-neutral-950 font-black py-4 rounded-2xl uppercase text-xs tracking-wider transition-all duration-300 transform hover:brightness-110 hover:scale-[1.02] shadow-xl"
        >
          🤖 Revisar Pedido
        </button>
      </div>

      {/* MODAL DE CHAT INTERACTIVO */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-neutral-900 w-full sm:max-w-md h-[85vh] sm:h-[650px] rounded-t-2xl sm:rounded-2xl border border-stone-800 flex flex-col justify-between shadow-2xl overflow-hidden">
            
            <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-neutral-950">
              <span className="font-bold text-xs tracking-wider uppercase text-amber-500">Terminal de Cocina</span>
              <button onClick={() => setIsChatOpen(false)} className="text-stone-400 hover:text-stone-100 text-xs font-bold uppercase bg-stone-800 px-3 py-1 rounded-lg">Cerrar</button>
            </div>

            {/* Ventana de mensajes del chat */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-950/40">
              {mensajes.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-amber-500 text-neutral-950 font-semibold' : 'bg-stone-800 text-stone-100 border border-stone-750'
                  }`}>
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                </div>
              ))}

              {cargando && (
                <div className="text-left">
                  <span className="inline-block bg-stone-800/80 text-stone-400 text-xs px-3 py-1.5 rounded-full animate-pulse">
                    Procesando detalles del pedido...
                  </span>
                </div>
              )}

              {/* BOTÓN DE TRANSICIÓN: Aparece en español tras el cálculo de la IA */}
              {Object.values(cantidades).some(qty => qty > 0) && !isConfirmedByAI && mensajes.length > 1 && !cargando && (
                <div className="text-center pt-2">
                  <button 
                    onClick={() => setIsConfirmedByAI(true)}
                    className="bg-zinc-100 text-neutral-900 font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all shadow-md animate-bounce"
                  >
                    👍 Confirmar Productos y Datos de Envío
                  </button>
                </div>
              )}

              {/* FORMULARIO HTML DE ENTREGA EN ESPAÑOL */}
              {isConfirmedByAI && !orderSubmitted && (
                <form onSubmit={enviarFormularioAWhatsApp} className="mt-4 bg-neutral-950 p-4 rounded-xl border border-stone-800 space-y-3">
                  <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider border-b border-stone-900 pb-2 mb-2">Datos de Entrega</h4>
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-stone-400 mb-1">Nombre Completo</label>
                    <input 
                      type="text" required value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej. Juan David"
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-stone-400 mb-1">Dirección de Envío</label>
                    <input 
                      type="text" required value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ej. Calle 10 #14-25"
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-stone-400 mb-1">Teléfono Celular</label>
                    <input 
                      type="tel" required value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Ej. 3213166885"
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button 
                    type="submit" disabled={cargando}
                    className="w-full mt-2 bg-amber-500 text-neutral-950 font-black py-2.5 rounded-lg text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors disabled:opacity-50"
                  >
                    Enviar Pedido a la Cocina
                  </button>
                </form>
              )}
            </div>

            {/* ENTRADA DE TEXTO PARA EL CHAT CON LA IA */}
            {!isConfirmedByAI && (
              <form onSubmit={manejarEnvioManual} className="p-3 border-t border-stone-800 bg-neutral-950 flex gap-2">
                <input 
                  type="text" value={inputUsuario} 
                  onChange={(e) => setInputUsuario(e.target.value)}
                  placeholder="Escribe a Gemini para modificar o confirmar..." 
                  className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-100 focus:outline-none focus:border-amber-500 placeholder:text-stone-600"
                />
                <button type="submit" className="bg-amber-500 text-neutral-950 font-black px-5 rounded-xl text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors">Chat</button>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
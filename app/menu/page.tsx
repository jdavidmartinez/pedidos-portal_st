'use client';

import Image from 'next/image';
import React, { useMemo, useState } from 'react';
import { MENU_PORTAL, Producto } from './data';
import type { Order } from '@/types/order';

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

  const [isConfirmedByAI, setIsConfirmedByAI] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [observations, setObservations] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const itemsSeleccionados = useMemo(
    () =>
      Object.entries(cantidades)
        .filter(([, quantity]) => quantity > 0)
        .map(([name, quantity]) => {
          const product = Object.values(MENU_PORTAL)
            .flat()
            .find((item) => item.nombre === name);

          return {
            name,
            quantity,
            unitPrice: product?.precioIndividual ?? 0,
          };
        }),
    [cantidades]
  );

  const cantidadTotal = itemsSeleccionados.reduce((total, item) => total + item.quantity, 0);
  const subtotal = itemsSeleccionados.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0
  );

  const cambiarCantidad = (nombre: string, incremento: number) => {
    setCantidades(prev => ({
      ...prev,
      [nombre]: Math.max(0, (prev[nombre] || 0) + incremento)
    }));
  };

  const cerrarChat = () => {
    setIsChatOpen(false);

    if (orderSubmitted) {
      setCantidades({});
      setCustomerName('');
      setDeliveryAddress('');
      setPhoneNumber('');
      setObservations('');
      setMensajes([]);
      setInputUsuario('');
      setIsConfirmedByAI(false);
      setOrderSubmitted(false);
      setSubmitError('');
    }
  };

  const iniciarOrdenConIA = async () => {
    setIsChatOpen(true);
    setIsConfirmedByAI(false);
    setOrderSubmitted(false);
    setSubmitError('');
    
    const seleccionados = Object.entries(cantidades)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => `${qty}x ${name}`);

    if (seleccionados.length > 0) {
      const ordenInicial = `Hola, quiero ordenar los siguientes productos del menú:\n${seleccionados.join('\n')}.\nPor favor calcula el precio total y confirma mi pedido en español. Recuerda informarme explícitamente que el costo NO incluye el domicilio, y que el valor del envío será confirmado por el restaurante al enviar el pedido.`;
      const nuevosMensajes = [{ role: 'user', text: `👋 ¡Hola! Quiero revisar este pedido:\n${seleccionados.join(', ')}` } as Mensaje];
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
        console.error("Error communicating with AI:", err);
      } finally {
        setCargando(false);
      }
    } else {
      setMensajes([{ role: 'bot', text: '¡Hola! Tu canasta está vacía. Selecciona productos del menú o cuéntame directamente por aquí qué te gustaría ordenar.' }]);
    }
  };

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
      console.error("Error processing message:", err);
    } finally {
      setCargando(false);
    }
  };

  const enviarFormularioACocina = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !deliveryAddress.trim() || !phoneNumber.trim()) return;

    const items = Object.entries(cantidades)
      .filter(([, qty]) => qty > 0)
      .map(([name, quantity]) => ({ name, quantity }));

    if (items.length === 0) {
      setSubmitError('Selecciona al menos un producto del menú antes de enviar el pedido.');
      return;
    }

    setCargando(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: customerName,
            address: deliveryAddress,
            phone: phoneNumber,
          },
          items,
          observations: observations.trim() || undefined,
        })
      });
      const data = await response.json() as { order?: Order; error?: string };

      if (response.ok && data.order) {
        const createdOrder = data.order;
        setOrderSubmitted(true);
        setMensajes(prev => [
          ...prev,
          {
            role: 'bot',
            text: `¡Excelente! Tu pedido #${String(createdOrder.number).padStart(4, '0')} fue recibido por la cocina.`,
          },
        ]);
      } else {
        throw new Error(data.error || 'No fue posible enviar el pedido a la cocina.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No fue posible enviar el pedido.';
      setSubmitError(message);
      console.error("Order routing error:", err);
    } finally {
      setCargando(false);
    }
  };

  const formatCOP = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  };

  const fontMain = '"Fredoka", sans-serif';
  const fontSecondary = '"Comic Neue", cursive';

  return (
    /* Global user text selection matching brand red #B03336 */
    <div className="relative min-h-screen pb-12 selection:bg-[#B03336] selection:text-[#FEFEFE]">
      
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Fredoka:wght@600;700;900&display=swap');
      `}} />

      {/* Global Background Layer */}
      <div 
        className="fixed inset-0 -z-10"
        style={{ 
          backgroundImage: `linear-gradient(rgba(32, 30, 30, 0.90), rgba(32, 30, 30, 0.94)), url('https://images.unsplash.com/photo-1504198453319-5ce911bafcde?q=80&w=1280')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat-y'
        }}
      />
      
      {/* SOLID BLACK HEADER BANNER - Underlined with exact brand red #B03336 */}
      <header className="relative flex w-full items-center justify-center border-b-4 border-[#B03336] bg-black px-4 py-6">
        <div className="relative max-w-sm transition-transform duration-350 hover:scale-102">
          <Image
            src="/images/Logo-Portal.png" 
            alt="Portal Street Brand Logo"
            width={1600}
            height={1600}
            loading="eager"
            className="h-24 w-24 object-contain sm:h-28 sm:w-28 md:h-32 md:w-32"
          />
        </div>
      </header>

      {/* Navigation Selection Layer */}
      <nav className="relative bg-black/40 backdrop-blur-xs px-4 py-4 flex gap-2 overflow-x-auto sm:grid sm:grid-cols-3 max-w-4xl mx-auto w-full">
        {Object.keys(MENU_PORTAL).map((cat) => (
          <button 
            key={cat} 
            onClick={() => setCategoriaActiva(cat)} 
            style={{ fontFamily: fontMain, fontWeight: 700 }}
            /* COLOR CORRECTION: Active state background and custom border set explicitly 
              to hex color #B03336 to lock down a single visual language across the layout.
            */
            className={`w-full min-w-max px-5 py-3 rounded-xl font-bold text-sm tracking-wider transition-all uppercase border-2 ${
              categoriaActiva === cat 
                ? 'bg-[#B03336] text-[#FEFEFE] border-[#B03336] shadow-xl transform scale-[1.01]' 
                : 'bg-[#201E1E]/95 text-[#FEFEFE]/80 border-neutral-800/80 hover:border-[#B03336]'
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Main Catalog View */}
      <section
        aria-label="Resumen del pedido"
        className="sticky top-0 z-30 mx-auto w-full max-w-4xl bg-black/95 px-4 py-2 backdrop-blur-md"
        style={{ position: 'sticky', top: 0, zIndex: 30 }}
      >
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#B03336]/60 bg-[#201E1E] px-4 py-3 shadow-xl">
          <div className="min-w-0 flex-1 text-left">
            <p style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-xs uppercase tracking-wider text-[#FEFEFE]">
              {cantidadTotal === 0 ? 'Tu pedido está vacío' : `${cantidadTotal} ${cantidadTotal === 1 ? 'producto' : 'productos'} en tu pedido`}
            </p>
            <p style={{ fontFamily: fontSecondary }} className="text-sm text-[#FEFEFE]/65">
              {cantidadTotal === 0 ? 'Selecciona productos para comenzar' : `Subtotal ${formatCOP(subtotal)}`}
            </p>
          </div>
          <button
            onClick={iniciarOrdenConIA}
            disabled={cantidadTotal === 0}
            style={{ fontFamily: fontMain, fontWeight: 700, backgroundColor: cantidadTotal === 0 ? '#525252' : '#B03336' }}
            className="shrink-0 rounded-xl border border-amber-500/20 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#FEFEFE] shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:text-[#FEFEFE]/45 disabled:hover:scale-100 sm:px-6"
          >
            {cantidadTotal === 0 ? 'Selecciona productos' : 'Revisar pedido'}
          </button>
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {MENU_PORTAL[categoriaActiva]?.map((plato: Producto, idx: number) => {
            const cantidadActual = cantidades[plato.nombre] || 0;
            return (
              /* Hover cards border line highlighted with brand red #B03336 */
              <div key={idx} className="bg-[#201E1E]/95 rounded-2xl overflow-hidden border-2 border-neutral-800/60 flex flex-col justify-between shadow-2xl transition-all duration-300 hover:border-[#B03336]/50">
                <div className="relative h-40 w-full overflow-hidden bg-neutral-900 sm:h-44">
                  <img src={plato.imagen} alt={plato.nombre} className="w-full h-full object-cover" />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-xl text-[#facc15] uppercase tracking-wide drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
                      {plato.nombre}
                    </h3>
                    <p style={{ fontFamily: fontSecondary }} className="mt-2 text-xs text-[#FEFEFE]/90 font-normal leading-relaxed">
                      {plato.descripcion}
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-neutral-800/60 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#FEFEFE]/50 uppercase font-black tracking-wider">Individual</span>
                      <span style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-xl text-[#FEFEFE]">
                        {formatCOP(plato.precioIndividual)}
                      </span>
                    </div>
                    <div className="flex items-center bg-black/50 rounded-xl p-1 border border-neutral-800">
                      {/* Counter interface colors adjusted to hover on brand red #B03336 */}
                      <button aria-label={`Quitar una unidad de ${plato.nombre}`} onClick={() => cambiarCantidad(plato.nombre, -1)} className="w-8 h-8 text-[#FEFEFE]/70 hover:text-[#B03336] font-bold text-lg transition-colors">-</button>
                      <span style={{ fontFamily: fontMain, fontWeight: 700 }} className="w-8 text-center text-base text-[#FEFEFE]">{cantidadActual}</span>
                      <button aria-label={`Agregar una unidad de ${plato.nombre}`} onClick={() => cambiarCantidad(plato.nombre, 1)} className="w-8 h-8 text-[#FEFEFE]/70 hover:text-[#B03336] font-bold text-lg transition-colors">+</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Terminal Modal System */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Modal layout framing accented using #B03336 */}
          <div className="bg-[#201E1E] w-full sm:max-w-md h-[85vh] sm:h-[650px] rounded-t-2xl sm:rounded-2xl border-2 border-[#B03336]/40 flex flex-col justify-between shadow-2xl overflow-hidden">
            
            <div className="p-4 border-b border-neutral-850 flex justify-between items-center bg-neutral-950">
              <span style={{ fontFamily: fontMain, fontWeight: 700 }} className="font-bold text-xs tracking-wider uppercase text-[#B03336]">Terminal de Cocina</span>
              <button onClick={cerrarChat} style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-[#FEFEFE]/70 hover:text-[#FEFEFE] text-xs bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">Cerrar</button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-black/20">
              {mensajes.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    style={{ fontFamily: fontSecondary }}
                    /* Outgoing user dialogue box adjusted to brand red #B03336 */
                    className={`max-w-[85%] rounded-xl p-3 text-sm leading-relaxed ${
                      msg.role === 'user' ? 'bg-[#B03336] text-[#FEFEFE] font-bold shadow-md' : 'bg-neutral-900 text-[#FEFEFE] border border-neutral-800'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                </div>
              ))}

              {cargando && (
                <div className="text-left">
                  <span style={{ fontFamily: fontSecondary }} className="inline-block bg-neutral-900 text-[#FEFEFE]/60 text-xs px-3 py-1.5 rounded-full animate-pulse">
                    Procesando detalles del pedido...
                  </span>
                </div>
              )}

              {(!isConfirmedByAI && (Object.values(cantidades).some(qty => qty > 0) || mensajes.length > 1) && !cargando) && (
                <div className="text-center pt-2">
                  <button 
                    onClick={() => setIsConfirmedByAI(true)}
                    style={{ fontFamily: fontMain, fontWeight: 700 }}
                    className="bg-[#FEFEFE] text-neutral-950 font-black px-6 py-3 rounded-lg text-xs uppercase tracking-wider hover:bg-neutral-100 shadow-md animate-bounce"
                  >
                    👍 Confirmar Productos y Datos de Envío
                  </button>
                </div>
              )}

              {isConfirmedByAI && !orderSubmitted && (
                <form onSubmit={enviarFormularioACocina} className="mt-4 bg-black/45 p-4 rounded-xl border border-neutral-800 space-y-3">
                  <h4 style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-xs font-black uppercase text-[#B03336] tracking-wider border-b border-neutral-800 pb-2 mb-2">Datos de Entrega</h4>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-xs uppercase tracking-wider text-[#FEFEFE]">Resumen del pedido</p>
                      <span style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-sm text-[#facc15]">{formatCOP(subtotal)}</span>
                    </div>
                    <ul className="space-y-1 text-xs text-[#FEFEFE]/75">
                      {itemsSeleccionados.map((item) => (
                        <li key={item.name} className="flex justify-between gap-3">
                          <span>{item.quantity}x {item.name}</span>
                          <span className="shrink-0">{formatCOP(item.quantity * item.unitPrice)}</span>
                        </li>
                      ))}
                    </ul>
                    <p style={{ fontFamily: fontSecondary }} className="mt-2 text-[11px] text-[#FEFEFE]/45">El domicilio se confirma por separado con el restaurante.</p>
                  </div>
                  <div>
                    <label style={{ fontFamily: fontSecondary }} className="block text-[11px] uppercase font-bold text-[#FEFEFE]/60 mb-1">Nombre Completo</label>
                    <input 
                      type="text" required value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej. Marcela"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-[#FEFEFE] focus:outline-none focus:border-[#B03336] placeholder:text-neutral-700"
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: fontSecondary }} className="block text-[11px] uppercase font-bold text-[#FEFEFE]/60 mb-1">Dirección de Envío</label>
                    <input 
                      type="text" required value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ej. Calle 10 #14-25"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-[#FEFEFE] focus:outline-none focus:border-[#B03336] placeholder:text-neutral-700"
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: fontSecondary }} className="block text-[11px] uppercase font-bold text-[#FEFEFE]/60 mb-1">Teléfono Celular</label>
                    <input 
                      type="tel" required value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Ej. 3213166885"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-[#FEFEFE] focus:outline-none focus:border-[#B03336] placeholder:text-neutral-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="order-observations" style={{ fontFamily: fontSecondary }} className="block text-[11px] uppercase font-bold text-[#FEFEFE]/60 mb-1">
                      Observaciones <span className="normal-case font-normal text-[#FEFEFE]/40">(opcional)</span>
                    </label>
                    <textarea
                      id="order-observations"
                      value={observations}
                      onChange={(event) => setObservations(event.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Ej. Sin cebolla, llamar al llegar..."
                      className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-[#FEFEFE] outline-none focus:border-[#B03336] placeholder:text-neutral-700"
                    />
                    <p className="mt-1 text-right text-[10px] text-[#FEFEFE]/35">{observations.length}/500</p>
                  </div>
                  <button 
                    type="submit" disabled={cargando}
                    style={{ fontFamily: fontMain, fontWeight: 700, backgroundColor: '#B03336' }}
                    className="w-full mt-2 text-[#FEFEFE] font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    Enviar Pedido a la Cocina
                  </button>
                  {submitError && (
                    <p
                      role="alert"
                      style={{ fontFamily: fontSecondary }}
                      className="text-xs text-red-300"
                    >
                      {submitError}
                    </p>
                  )}
                </form>
              )}
            </div>

            {!isConfirmedByAI && (
              <form onSubmit={manejarEnvioManual} className="p-3 border-t border-neutral-800 bg-neutral-950 flex gap-2">
                <input 
                  type="text" value={inputUsuario} 
                  onChange={(e) => setInputUsuario(e.target.value)}
                  placeholder="Escribe a Gemini..." 
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-[#FEFEFE] focus:outline-none focus:border-[#B03336]"
                />
                <button type="submit" style={{ fontFamily: fontMain, fontWeight: 700, backgroundColor: '#B03336' }} className="text-[#FEFEFE] font-bold px-5 rounded-xl text-xs uppercase tracking-wider">Chat</button>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

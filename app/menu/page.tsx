'use client';

import React, { useState } from 'react';
import { MENU_PORTAL, Producto } from './data';

export default function LandingMenuPage() {
  const [categoriaActiva, setCategoriaActiva] = useState<string>(Object.keys(MENU_PORTAL)[0]);

  // Formateador de moneda colombiana
  const formatCOP = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-stone-900 text-amber-50 font-sans pb-24">
      {/* Banner Superior Estilo Rústico */}
      <header className="relative bg-neutral-950 text-center py-16 px-4 shadow-xl border-b border-amber-600/20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000')] opacity-10 bg-cover bg-center"></div>
        <div className="relative">
          <h1 className="text-5xl font-black tracking-wider text-amber-500 uppercase">Portal ST</h1>
          <p className="mt-2 text-sm uppercase tracking-widest text-stone-400">Sabores Artesanales a la Parrilla</p>
        </div>
      </header>

      {/* Selector de Categorías (Navegación horizontal fluida en móviles) */}
      <nav className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur-md border-b border-stone-850 px-4 py-3 overflow-x-auto flex gap-2 justify-start sm:justify-center no-scrollbar">
        {Object.keys(MENU_PORTAL).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoriaActiva(cat)}
            className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all duration-200 ${
              categoriaActiva === cat
                ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Cuerpo del Menú */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {MENU_PORTAL[categoriaActiva].map((plato: Producto, idx: number) => (
            <div 
              key={idx} 
              className="bg-neutral-950 rounded-2xl overflow-hidden border border-stone-800/60 shadow-lg flex flex-col justify-between"
            >
              {/* Imagen */}
              <div className="h-56 w-full relative bg-stone-900">
                <img 
                  src={plato.imagen} 
                  alt={plato.nombre}
                  className="w-full h-full object-cover grayscale-[10%] hover:grayscale-0 transition-all duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent"></div>
              </div>

              {/* Contenido Técnico */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-extrabold tracking-wide text-stone-100 uppercase">{plato.nombre}</h3>
                  <p className="mt-2 text-sm text-stone-400 leading-relaxed font-light">{plato.descripcion}</p>
                </div>

                {/* Precios e Interfaz de Compra */}
                <div className="mt-6 pt-4 border-t border-stone-900 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-stone-500 font-semibold uppercase">Individual</span>
                    <span className="text-lg font-black text-amber-500">{formatCOP(plato.precioIndividual)}</span>
                  </div>
                  
                  {plato.precioCombo && (
                    <div className="flex flex-col gap-1 text-right bg-stone-900/50 px-3 py-1.5 rounded-xl border border-stone-800">
                      <span className="text-xs text-amber-500 font-bold uppercase flex items-center gap-1 justify-end">
                        🍔🍟 Combo
                      </span>
                      <span className="text-lg font-black text-stone-100">{formatCOP(plato.precioCombo)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Botón Flotante para Ordenar vía Gemini */}
      <div className="fixed bottom-6 inset-x-4 z-50 text-center">
        <a 
          href="https://wa.me/1208835768972526" // Link de tu API de pruebas de WhatsApp
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-3 w-full max-w-md bg-gradient-to-r from-emerald-600 to-green-500 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-green-900/30 hover:brightness-110 active:scale-[0.99] transition-all duration-200 uppercase tracking-wider text-sm"
        >
          <span className="text-xl">💬</span> Ordenar con el Asistente IA
        </a>
      </div>
    </div>
  );
}
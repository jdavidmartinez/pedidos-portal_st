'use client';

/* eslint-disable @next/next/no-img-element -- El catálogo admite URLs configurables por el administrador. */

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CategoriasMenu, Producto } from './data';
import type { Order } from '@/types/order';
import { DATA_PROCESSING_POLICY_VERSION } from '@/lib/privacy/data-processing';

interface Mensaje {
  role: 'user' | 'bot';
  text: string;
}

interface MenuCampaign {
  id: string;
  name: string;
  imageUrl: string;
  products: Array<{ id: string; name: string; imageUrl: string }>;
  discountPercent: number;
  startsOn: string;
  endsOn: string;
}

interface RememberedCustomerDetails {
  name: string;
  address: string;
  phone: string;
  savedAt: number;
}

type ProductVariant = 'individual' | 'combo';

const quantityKey = (name: string, variant: ProductVariant) => `${name}\u0000${variant}`;
const splitQuantityKey = (key: string) => {
  const [name, variant] = key.split('\u0000');
  return { name, variant: variant === 'combo' ? 'combo' as const : 'individual' as const };
};

const REMEMBERED_CUSTOMER_KEY = 'portal-st:remembered-customer:v1';
const REMEMBERED_CUSTOMER_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function readRememberedCustomer(): RememberedCustomerDetails | null {
  try {
    const stored = window.localStorage.getItem(REMEMBERED_CUSTOMER_KEY);
    if (!stored) return null;

    const value = JSON.parse(stored) as Partial<RememberedCustomerDetails>;
    const valid =
      typeof value.name === 'string' &&
      typeof value.address === 'string' &&
      typeof value.phone === 'string' &&
      typeof value.savedAt === 'number' &&
      Date.now() - value.savedAt <= REMEMBERED_CUSTOMER_TTL_MS;

    if (!valid) {
      window.localStorage.removeItem(REMEMBERED_CUSTOMER_KEY);
      return null;
    }

    return value as RememberedCustomerDetails;
  } catch {
    try {
      window.localStorage.removeItem(REMEMBERED_CUSTOMER_KEY);
    } catch {
      // Algunos navegadores bloquean por completo el almacenamiento local.
    }
    return null;
  }
}

function clearRememberedCustomer() {
  try {
    window.localStorage.removeItem(REMEMBERED_CUSTOMER_KEY);
  } catch {
    // El pedido debe seguir funcionando aunque el navegador bloquee storage.
  }
}

function writeRememberedCustomer(value: RememberedCustomerDetails) {
  try {
    window.localStorage.setItem(REMEMBERED_CUSTOMER_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function formatPromotionDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(`${value}T12:00:00-05:00`));
}

export default function LandingMenuPage() {
  const [menu, setMenu] = useState<CategoriasMenu>({});
  const [categoriaActiva, setCategoriaActiva] = useState('');
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [campaign, setCampaign] = useState<MenuCampaign | null>(null);
  const [showCampaign, setShowCampaign] = useState(false);
  const [cantidades, setCantidades] = useState<{ [key: string]: number }>({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGeminiMode, setIsGeminiMode] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [inputUsuario, setInputUsuario] = useState('');
  const [cargando, setCargando] = useState(false);

  const [isConfirmedByAI, setIsConfirmedByAI] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rememberCustomer, setRememberCustomer] = useState(false);
  const [hasRememberedCustomer, setHasRememberedCustomer] = useState(false);
  const [observations, setObservations] = useState('');
  const [orderIdempotencyKey, setOrderIdempotencyKey] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [submitError, setSubmitError] = useState('');
  const campaignDialogRef = useRef<HTMLElement>(null);
  const orderDialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const orderSubmittedRef = useRef(orderSubmitted);
  const rememberCustomerRef = useRef(rememberCustomer);

  useEffect(() => {
    orderSubmittedRef.current = orderSubmitted;
    rememberCustomerRef.current = rememberCustomer;
  }, [orderSubmitted, rememberCustomer]);

  useEffect(() => {
    const remembered = readRememberedCustomer();
    if (!remembered) return;

    const loadRemembered = window.setTimeout(() => {
      setCustomerName(remembered.name);
      setDeliveryAddress(remembered.address);
      setPhoneNumber(remembered.phone);
      setRememberCustomer(true);
      setHasRememberedCustomer(true);
    }, 0);

    return () => window.clearTimeout(loadRemembered);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const cargarMenu = async () => {
      setMenuLoading(true);
      setMenuError('');

      try {
        const response = await fetch('/api/menu', { cache: 'no-store' });
        const payload = await response.json() as {
          categories?: Array<{
            name: string;
            products: Array<{
              id: string;
              slug: string;
              name: string;
              description: string;
              individualPrice: number;
              comboPrice: number | null;
              imageUrl: string;
            }>;
          }>;
          campaign?: MenuCampaign | null;
          error?: string;
        };

        if (!response.ok || !payload.categories) {
          throw new Error(payload.error || 'No fue posible cargar el menú.');
        }

        if (!cancelled) {
          const nextMenu = payload.categories.reduce<CategoriasMenu>((catalog, category) => {
            catalog[category.name] = category.products.map((product) => ({
              id: product.id,
              slug: product.slug,
              nombre: product.name,
              descripcion: product.description,
              precioIndividual: product.individualPrice,
              precioCombo: product.comboPrice,
              imagen: product.imageUrl,
            }));
            return catalog;
          }, {});

          setMenu(nextMenu);
          const activeCampaign = payload.campaign && payload.campaign.products.length > 0
            ? payload.campaign
            : null;
          setCampaign(activeCampaign);
          setShowCampaign(Boolean(activeCampaign));
          setCategoriaActiva((current) => current && nextMenu[current]
            ? current
            : Object.keys(nextMenu)[0] || '');
        }
      } catch (error) {
        if (!cancelled) {
          setMenuError(error instanceof Error ? error.message : 'No fue posible cargar el menú.');
        }
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    };

    void cargarMenu();
    return () => { cancelled = true; };
  }, []);

  const itemsSeleccionados = useMemo(
    () =>
      Object.entries(cantidades)
        .filter(([, quantity]) => quantity > 0)
        .map(([key, quantity]) => {
          const { name, variant } = splitQuantityKey(key);
          const product = Object.values(menu)
            .flat()
            .find((item) => item.nombre === name);

          return {
            name,
            variant,
            quantity,
            unitPrice: variant === 'combo'
              ? product?.precioCombo ?? 0
              : product?.precioIndividual ?? 0,
          };
        }),
    [cantidades, menu]
  );

  const cantidadTotal = itemsSeleccionados.reduce((total, item) => total + item.quantity, 0);
  const subtotal = itemsSeleccionados.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0
  );

  const cambiarCantidad = (nombre: string, variant: ProductVariant, incremento: number) => {
    const key = quantityKey(nombre, variant);
    setCantidades(prev => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + incremento)
    }));
  };

  const cerrarChat = useCallback(() => {
    setIsChatOpen(false);

    if (orderSubmittedRef.current) {
      setCantidades({});
      if (!rememberCustomerRef.current) {
        setCustomerName('');
        setDeliveryAddress('');
        setPhoneNumber('');
      }
      setObservations('');
      setOrderIdempotencyKey('');
      setMensajes([]);
      setInputUsuario('');
      setIsConfirmedByAI(false);
      setOrderSubmitted(false);
      setSubmittedOrder(null);
      setSubmitError('');
      setIsGeminiMode(false);
    }
  }, []);

  useEffect(() => {
    const dialog = showCampaign
      ? campaignDialogRef.current
      : isChatOpen
        ? orderDialogRef.current
        : null;
    if (!dialog) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableSelector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const firstControl = dialog.querySelector<HTMLElement>(focusableSelector);
    window.requestAnimationFrame(() => (firstControl ?? dialog).focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showCampaign) setShowCampaign(false);
        else cerrarChat();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [cerrarChat, isChatOpen, showCampaign]);

  const forgetCustomerDetails = () => {
    clearRememberedCustomer();
    setRememberCustomer(false);
    setHasRememberedCustomer(false);
    setCustomerName('');
    setDeliveryAddress('');
    setPhoneNumber('');
  };

  const abrirFormularioPedido = () => {
    setIsChatOpen(true);
    setIsGeminiMode(false);
    setIsConfirmedByAI(true);
    setOrderSubmitted(false);
    setSubmittedOrder(null);
    setSubmitError('');
    setMensajes([]);
    setInputUsuario('');
    setOrderIdempotencyKey(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  };

  const iniciarOrdenConIA = async () => {
    setIsChatOpen(true);
    setIsGeminiMode(true);
    setIsConfirmedByAI(false);
    setOrderSubmitted(false);
    setSubmittedOrder(null);
    setSubmitError('');
    setOrderIdempotencyKey(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    
    const seleccionados = itemsSeleccionados
      .map((item) => `${item.quantity}x ${item.name} (${item.variant === 'combo' ? 'Combo' : 'Individual'})`);

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

    const items = itemsSeleccionados.map(({ name, variant, quantity }) => ({ name, variant, quantity }));

    if (items.length === 0) {
      setSubmitError('Selecciona al menos un producto del menú antes de enviar el pedido.');
      return;
    }

    setCargando(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': orderIdempotencyKey || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        },
        body: JSON.stringify({
          customer: {
            name: customerName,
            address: deliveryAddress,
            phone: phoneNumber,
          },
          items,
          observations: observations.trim() || undefined,
          dataConsent: true,
          dataConsentVersion: DATA_PROCESSING_POLICY_VERSION,
        })
      });
      const data = await response.json() as { order?: Order; error?: string };

      if (response.ok && data.order) {
        const createdOrder = data.order;
        if (rememberCustomer) {
          const remembered = writeRememberedCustomer({
              name: customerName.trim(),
              address: deliveryAddress.trim(),
              phone: phoneNumber.trim(),
              savedAt: Date.now(),
            });
          setHasRememberedCustomer(remembered);
        } else {
          clearRememberedCustomer();
          setHasRememberedCustomer(false);
        }
        setOrderSubmitted(true);
        setSubmittedOrder(createdOrder);
        setMensajes(prev => [
          ...prev,
          {
            role: 'bot',
            text: 'Tu pedido ha sido recibido por el restaurante.',
          },
        ]);
      } else {
        throw new Error(data.error || 'No fue posible enviar el pedido al restaurante.');
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

      {/* Category navigation */}
      <section className="relative mx-auto w-full max-w-4xl overflow-hidden border-y border-[#B03336]/70 bg-[#171717] shadow-[0_14px_35px_rgba(0,0,0,0.38)]">
        <div className="h-1 w-full bg-gradient-to-r from-[#B03336] via-[#facc15] to-[#B03336]" />
        <div className="px-4 pb-4 pt-3 sm:px-5">
          <div className="mb-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 flex-col justify-center gap-1.5 rounded-xl border border-[#facc15]/60 bg-black/35 px-2.5 shadow-inner"
            >
              <span className="h-0.5 w-full rounded-full bg-[#facc15]" />
              <span className="h-0.5 w-full rounded-full bg-[#facc15]" />
              <span className="h-0.5 w-full rounded-full bg-[#facc15]" />
            </span>
            <div className="min-w-0">
              <p
                style={{ fontFamily: fontMain, fontWeight: 700 }}
                className="text-[10px] uppercase tracking-[0.28em] text-[#facc15]"
              >
                Explora el menú
              </p>
              <h2
                style={{ fontFamily: fontMain, fontWeight: 700 }}
                className="mt-0.5 text-base uppercase tracking-wide text-white sm:text-lg"
              >
                Elige una sección
              </h2>
            </div>
          </div>

          <nav
            aria-label="Secciones del menú"
            className="flex w-full flex-col gap-2"
          >
            {Object.keys(menu).map((cat, index) => {
              const active = categoriaActiva === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setCategoriaActiva(cat)}
                  style={{ fontFamily: fontMain, fontWeight: 700 }}
                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 text-left font-bold uppercase tracking-wider transition-all duration-200 ${
                    active
                      ? 'border-[#facc15] bg-[#B03336] text-white shadow-[0_8px_24px_rgba(176,51,54,0.3)]'
                      : 'border-white/15 bg-[#252323] text-white/75 hover:border-[#B03336] hover:bg-[#2d2929] hover:text-white'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] transition-colors ${
                      active
                        ? 'border-white/40 bg-black/20 text-[#facc15]'
                        : 'border-white/10 bg-black/25 text-white/45 group-hover:text-[#facc15]'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 text-sm sm:text-base">{cat}</span>
                  <span
                    aria-hidden="true"
                    className={`text-lg transition-transform duration-200 ${active ? 'rotate-90 text-[#facc15]' : 'text-white/35 group-hover:translate-x-0.5 group-hover:text-white'}`}
                  >
                    ›
                  </span>
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#facc15] transition-transform duration-200 ${
                      active ? 'scale-y-100' : 'scale-y-0'
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </section>

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
            <p style={{ fontFamily: fontSecondary }} className="text-sm font-medium text-white">
              {cantidadTotal === 0
                ? 'Selecciona productos para comenzar'
                : `Subtotal ${formatCOP(subtotal)}`}
            </p>
          </div>
          <button
            onClick={abrirFormularioPedido}
            disabled={cantidadTotal === 0}
            style={{ fontFamily: fontMain, fontWeight: 700, backgroundColor: cantidadTotal === 0 ? '#525252' : '#B03336' }}
            className="shrink-0 rounded-xl border border-amber-500/20 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#FEFEFE] shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:text-[#FEFEFE]/45 disabled:hover:scale-100 sm:px-6"
          >
            {cantidadTotal === 0 ? 'Selecciona productos' : 'Continuar con el pedido'}
          </button>
          <button
            type="button"
            onClick={iniciarOrdenConIA}
            className="basis-full rounded-lg border border-white/20 bg-neutral-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white transition hover:border-[#B03336] hover:bg-[#B03336]/20 sm:basis-auto"
          >
            🤖 ¿Necesitas ayuda? Hablar con Gemini
          </button>
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        {menuLoading && (
          <p className="py-12 text-center text-sm text-white" style={{ fontFamily: fontSecondary }}>
            Cargando el menú...
          </p>
        )}
        {!menuLoading && menuError && (
          <p role="alert" className="rounded-xl border border-red-400/60 bg-red-950/50 px-4 py-6 text-center text-sm text-red-100" style={{ fontFamily: fontSecondary }}>
            {menuError}
          </p>
        )}
        {!menuLoading && !menuError && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {menu[categoriaActiva]?.map((plato: Producto, idx: number) => {
            const cantidadIndividual = cantidades[quantityKey(plato.nombre, 'individual')] || 0;
            const cantidadCombo = cantidades[quantityKey(plato.nombre, 'combo')] || 0;
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
                  <fieldset className="mt-4 border-t border-neutral-800/60 pt-2.5">
                    <legend className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/65">Elige tu presentación</legend>
                    <div className={`mt-1.5 grid gap-1.5 ${plato.precioCombo !== null && plato.precioCombo !== undefined ? 'sm:grid-cols-2' : ''}`}>
                      <ProductOption
                        productName={plato.nombre}
                        variant="individual"
                        label="Individual"
                        price={plato.precioIndividual}
                        quantity={cantidadIndividual}
                        onChange={cambiarCantidad}
                        formatPrice={formatCOP}
                        fontFamily={fontMain}
                      />
                      {plato.precioCombo !== null && plato.precioCombo !== undefined && (
                        <ProductOption
                          productName={plato.nombre}
                          variant="combo"
                          label="Combo"
                          price={plato.precioCombo}
                          quantity={cantidadCombo}
                          onChange={cambiarCantidad}
                          formatPrice={formatCOP}
                          fontFamily={fontMain}
                          featured
                        />
                      )}
                    </div>
                  </fieldset>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </main>

      {campaign && showCampaign && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <section
            ref={campaignDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-title"
            aria-describedby="promotion-description"
            tabIndex={-1}
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-[#facc15]/80 bg-[#171717] text-white shadow-[0_28px_90px_rgba(0,0,0,0.7)]"
          >
            <button
              type="button"
              onClick={() => setShowCampaign(false)}
              aria-label="Cerrar promoción"
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/75 text-xl font-bold text-white transition hover:border-[#facc15] hover:text-[#facc15]"
            >
              ×
            </button>

            <div
              role="img"
              aria-label={`Productos en promoción: ${campaign.products.map((product) => product.name).join(', ')}`}
              className="h-52 w-full bg-neutral-900 bg-cover bg-center"
              style={{ backgroundImage: `linear-gradient(to top, rgba(23,23,23,1), rgba(23,23,23,0.05) 60%), url(${JSON.stringify(campaign.imageUrl || campaign.products[0]?.imageUrl || "")})` }}
            />

            <div className="relative -mt-10 px-6 pb-6">
              <p
                style={{ fontFamily: fontMain, fontWeight: 700 }}
                className="inline-flex rounded-full border border-[#facc15] bg-[#B03336] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white shadow-lg"
              >
                Promoción especial
              </p>
              <h2
                id="promotion-title"
                style={{ fontFamily: fontMain, fontWeight: 700 }}
                className="mt-3 text-3xl uppercase leading-tight text-[#facc15]"
              >
                {campaign.name}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {campaign.products.map((product) => (
                  <span
                    key={product.id}
                    style={{ fontFamily: fontMain, fontWeight: 700 }}
                    className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs uppercase text-white"
                  >
                    {product.name}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-[#B03336]/60 bg-[#201E1E] p-4">
                <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[#B03336] text-center shadow-[0_10px_30px_rgba(176,51,54,0.4)]">
                  <span style={{ fontFamily: fontMain, fontWeight: 900 }} className="text-2xl leading-none text-white">
                    {campaign.discountPercent}%
                  </span>
                  <span className="mt-1 text-[9px] font-black uppercase tracking-wider text-white/85">Descuento</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#facc15]">Vigencia</p>
                  <p style={{ fontFamily: fontSecondary }} className="mt-1 text-sm leading-relaxed text-white/85">
                    Del {formatPromotionDate(campaign.startsOn)} al {formatPromotionDate(campaign.endsOn)}.
                  </p>
                </div>
              </div>

              <p id="promotion-description" style={{ fontFamily: fontSecondary }} className="mt-4 text-xs leading-relaxed text-white/75">
                Promoción informativa. El restaurante confirmará y aplicará manualmente el descuento al facturar.
              </p>
              <button
                type="button"
                onClick={() => setShowCampaign(false)}
                style={{ fontFamily: fontMain, fontWeight: 700 }}
                className="mt-5 w-full rounded-xl border border-[#facc15] bg-[#d97706] px-5 py-3 text-xs uppercase tracking-widest text-white transition hover:brightness-110"
              >
                Ver el menú
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Terminal Modal System */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Modal layout framing accented using #B03336 */}
          <div
            ref={orderDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-dialog-title"
            tabIndex={-1}
            className="flex h-[92dvh] w-full flex-col justify-between overflow-hidden rounded-t-2xl border-2 border-[#B03336]/40 bg-[#201E1E] shadow-2xl sm:h-[650px] sm:max-w-md sm:rounded-2xl"
          >
            
            <div className="p-4 border-b border-neutral-850 flex justify-between items-center bg-neutral-950">
              <h2 id="order-dialog-title" style={{ fontFamily: fontMain, fontWeight: 700 }} className="font-bold text-xs tracking-wider uppercase text-red-300">
                {orderSubmitted ? 'Pedido recibido' : isGeminiMode ? 'Asistente Gemini' : 'Confirmar pedido'}
              </h2>
              <button
                onClick={cerrarChat}
                style={{ fontFamily: fontMain, fontWeight: 700 }}
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-white transition duration-200 hover:-translate-y-0.5 hover:border-[#B03336] hover:bg-[#B03336]/20 hover:text-white hover:shadow-lg active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
              >
                Cerrar
              </button>
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
                  <span style={{ fontFamily: fontSecondary }} className="inline-block bg-neutral-900 text-white text-xs px-3 py-1.5 rounded-full animate-pulse">
                    Procesando detalles del pedido...
                  </span>
                </div>
              )}

              {orderSubmitted && submittedOrder && (
                <section className="rounded-xl border border-[#facc15]/50 bg-neutral-950/80 p-4 shadow-lg">
                  <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-3">
                    <div>
                      <p style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-xs uppercase tracking-wider text-[#facc15]">
                        Tu pedido
                      </p>
                      <p style={{ fontFamily: fontSecondary }} className="mt-1 text-xs text-emerald-300">
                        Tu pedido ha sido recibido por el restaurante.
                      </p>
                    </div>
                    <span style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-sm text-[#facc15]">
                      {formatCOP(submittedOrder.subtotal)}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-white/80">
                    <p className="font-bold text-white">{submittedOrder.customer.name}</p>
                    <p className="mt-1">{submittedOrder.customer.address}</p>
                    <p className="mt-1">+{submittedOrder.customer.phone}</p>
                  </div>

                  <div className="mt-3 border-t border-neutral-800 pt-3">
                    <p style={{ fontFamily: fontMain, fontWeight: 700 }} className="mb-2 text-[11px] uppercase tracking-wider text-white/60">
                      Resumen del pedido
                    </p>
                    <ul className="space-y-1.5 text-xs text-white">
                      {submittedOrder.items.map((item) => (
                        <li key={`${item.name}-${item.variant}`} className="flex justify-between gap-3">
                          <span>{item.quantity}x {item.name} <strong className="text-[#facc15]">({item.variant === 'combo' ? 'Combo' : 'Individual'})</strong></span>
                          <span className="shrink-0 text-white/60">{formatCOP(item.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>
                    {submittedOrder.observations && (
                      <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-2.5">
                        <p className="text-[10px] font-bold uppercase text-amber-200">Observaciones</p>
                        <p className="mt-1 whitespace-pre-line text-xs text-amber-100">{submittedOrder.observations}</p>
                      </div>
                    )}
                    <p className="mt-3 text-[11px] text-white/60">
                      El valor del domicilio será confirmado por el restaurante.
                    </p>
                    <div className="mt-3 flex items-center gap-4 rounded-lg border border-[#25D366]/50 bg-[#25D366]/10 p-4 text-emerald-100">
                      <div
                        role="img"
                        aria-label="WhatsApp"
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.3)]"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-10 w-10 text-white"
                          fill="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p style={{ fontFamily: fontMain, fontWeight: 700 }} className="text-[10px] uppercase tracking-wider">
                          Pedido recibido
                        </p>
                        <p style={{ fontFamily: fontSecondary }} className="mt-1 text-xs leading-relaxed">
                          El restaurante recibió tu pedido y se comunicará directamente contigo por WhatsApp para confirmar los detalles.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
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
                    <ul className="space-y-1 text-xs font-medium text-white">
                      {itemsSeleccionados.map((item) => (
                        <li key={`${item.name}-${item.variant}`} className="flex justify-between gap-3">
                          <span>{item.quantity}x {item.name} <strong className="text-[#facc15]">({item.variant === 'combo' ? 'Combo' : 'Individual'})</strong></span>
                          <span className="shrink-0">{formatCOP(item.quantity * item.unitPrice)}</span>
                        </li>
                      ))}
                    </ul>
                    <p style={{ fontFamily: fontSecondary }} className="mt-2 text-[11px] text-white">El domicilio se confirma por separado con el restaurante.</p>
                  </div>
                  <div>
                    <label htmlFor="customer-name" style={{ fontFamily: fontSecondary }} className="block text-[11px] uppercase font-bold text-white mb-1">Nombre Completo</label>
                    <input 
                      id="customer-name"
                      autoComplete="name"
                      type="text" required value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Tu nombre"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B03336] placeholder:text-neutral-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="delivery-address" style={{ fontFamily: fontSecondary }} className="block text-[11px] uppercase font-bold text-white mb-1">Dirección de Envío</label>
                    <input 
                      id="delivery-address"
                      autoComplete="street-address"
                      type="text" required value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ej. Calle 10 #14-25"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B03336] placeholder:text-neutral-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="customer-phone" style={{ fontFamily: fontSecondary }} className="block text-[11px] uppercase font-bold text-white mb-1">Teléfono Celular</label>
                    <input 
                      id="customer-phone"
                      autoComplete="tel"
                      type="tel" required value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Ej. 3213166885"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#B03336] placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <label className="flex cursor-pointer items-start gap-3 text-[11px] leading-relaxed text-white/85">
                      <input
                        type="checkbox"
                        checked={rememberCustomer}
                        onChange={(event) => setRememberCustomer(event.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#B03336]"
                      />
                      <span>
                        <strong className="block text-white">Recordar mis datos en este dispositivo</strong>
                        Guarda nombre, dirección y teléfono en este navegador para completar más rápido futuros pedidos.
                      </span>
                    </label>
                    {hasRememberedCustomer && (
                      <button
                        type="button"
                        onClick={forgetCustomerDetails}
                        className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#facc15] underline underline-offset-2"
                      >
                        Olvidar mis datos
                      </button>
                    )}
                  </div>
                  <div>
                    <label htmlFor="order-observations" style={{ fontFamily: fontSecondary }} className="block text-[11px] uppercase font-bold text-white mb-1">
                      Observaciones <span className="normal-case font-normal text-white">(opcional)</span>
                    </label>
                    <textarea
                      id="order-observations"
                      value={observations}
                      onChange={(event) => setObservations(event.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Ej. Sin cebolla, llamar al llegar..."
                      className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-[#B03336] placeholder:text-neutral-400"
                    />
                    <p className="mt-1 text-right text-[10px] text-white">{observations.length}/500</p>
                  </div>
                  <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white/80">
                    Si continúas con el pedido, aceptas el tratamiento de tus datos
                    personales (nombre, dirección y teléfono) para gestionar y
                    entregar esta orden.
                    <a
                      href="/privacidad"
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 font-bold text-[#facc15] underline underline-offset-2"
                    >
                      Ver aviso de privacidad
                    </a>
                  </p>
                  <button 
                    type="submit" disabled={cargando}
                    style={{ fontFamily: fontMain, fontWeight: 700, backgroundColor: '#B03336' }}
                    className="mt-2 w-full rounded-lg py-2.5 text-xs font-bold uppercase tracking-widest text-[#FEFEFE] transition duration-200 hover:-translate-y-0.5 hover:bg-[#c13b3e] hover:shadow-lg active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
                  >
                    Enviar pedido
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
                  aria-label="Mensaje para Gemini"
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

function ProductOption({
  productName,
  variant,
  label,
  price,
  quantity,
  onChange,
  formatPrice,
  fontFamily,
  featured = false,
}: {
  productName: string;
  variant: ProductVariant;
  label: string;
  price: number;
  quantity: number;
  onChange: (name: string, variant: ProductVariant, increment: number) => void;
  formatPrice: (value: number) => string;
  fontFamily: string;
  featured?: boolean;
}) {
  const accessibleVariant = variant === 'combo' ? 'combo' : 'individual';
  return (
    <div className={`flex min-h-12 items-center gap-2 rounded-lg border px-2 py-1.5 ${featured ? 'border-[#facc15]/65 bg-[#B03336]/15' : 'border-white/15 bg-black/35'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {featured && <span aria-hidden="true" className="text-[9px] text-[#facc15]">★</span>}
          <span className={`truncate text-[9px] font-black uppercase tracking-wider ${featured ? 'text-[#facc15]' : 'text-white/60'}`}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <p style={{ fontFamily, fontWeight: 700 }} className="whitespace-nowrap text-sm leading-tight text-white">{formatPrice(price)}</p>
          {featured && (
            <span
              role="img"
              aria-label="Incluye papas fritas y gaseosa"
              title="Incluye papas fritas y gaseosa"
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-emerald-400/50 bg-emerald-950/70 px-1.5 py-0.5 text-sm leading-none shadow-inner"
            >
              <span aria-hidden="true">🍟</span>
              <span aria-hidden="true">🥤</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center rounded-md border border-white/10 bg-black/45 p-0.5">
        <button type="button" aria-label={`Quitar un ${accessibleVariant} de ${productName}`} onClick={() => onChange(productName, variant, -1)} className="h-10 w-10 rounded text-base font-bold text-white transition-colors hover:bg-[#B03336]">−</button>
        <span aria-live="polite" aria-label={`${quantity} unidades en presentación ${accessibleVariant} de ${productName}`} style={{ fontFamily, fontWeight: 700 }} className="w-6 text-center text-sm text-white">{quantity}</span>
        <button type="button" aria-label={`Agregar un ${accessibleVariant} de ${productName}`} onClick={() => onChange(productName, variant, 1)} className="h-10 w-10 rounded bg-black/35 text-base font-bold text-white transition-colors hover:bg-[#B03336]">+</button>
      </div>
    </div>
  );
}

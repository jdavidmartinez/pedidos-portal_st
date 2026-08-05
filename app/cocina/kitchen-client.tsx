"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatDeliveryFee,
  parseDeliveryFee,
} from "@/lib/orders/delivery-fee";
import { buildOrderWhatsAppUrl } from "@/lib/orders/whatsapp-link";
import { getTodayInColombia } from "@/lib/orders/date-range";
import type { Order, OrderStatus, UpdateOrderInput } from "@/types/order";
import type { MenuProduct } from "@/lib/menu/menu-repository";

const editItemKey = (name: string, variant: "individual" | "combo") => `${name}\u0000${variant}`;
const splitEditItemKey = (key: string) => {
  const [name, variant] = key.split("\u0000");
  return { name, variant: variant === "combo" ? "combo" as const : "individual" as const };
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Recibida",
  accepted: "Aceptada",
  preparing: "En proceso",
  dispatched: "Despachada",
  rejected: "Rechazada",
};

const STATUS_COLORS: Record<
  OrderStatus,
  {
    accent: string;
    surface: string;
    text: string;
    shadow: string;
  }
> = {
  received: {
    accent: "#fbbf24",
    surface: "rgba(251, 191, 36, 0.14)",
    text: "#fde68a",
    shadow: "0 18px 40px rgba(120, 53, 15, 0.24)",
  },
  accepted: {
    accent: "#38bdf8",
    surface: "rgba(56, 189, 248, 0.14)",
    text: "#bae6fd",
    shadow: "0 18px 40px rgba(12, 74, 110, 0.24)",
  },
  preparing: {
    accent: "#fb923c",
    surface: "rgba(251, 146, 60, 0.14)",
    text: "#fed7aa",
    shadow: "0 18px 40px rgba(124, 45, 18, 0.24)",
  },
  dispatched: {
    accent: "#34d399",
    surface: "rgba(52, 211, 153, 0.14)",
    text: "#a7f3d0",
    shadow: "0 18px 40px rgba(6, 78, 59, 0.24)",
  },
  rejected: {
    accent: "#f87171",
    surface: "rgba(248, 113, 113, 0.14)",
    text: "#fecaca",
    shadow: "0 18px 40px rgba(127, 29, 29, 0.24)",
  },
};

const PRIMARY_ACTIONS: Partial<
  Record<
    OrderStatus,
    {
      status: OrderStatus;
      label: string;
      backgroundColor: string;
      borderColor: string;
    }
  >
> = {
  received: {
    status: "accepted",
    label: "Aceptar en cocina",
    backgroundColor: "#d97706",
    borderColor: "#fbbf24",
  },
  accepted: {
    status: "preparing",
    label: "Iniciar preparación",
    backgroundColor: "#0284c7",
    borderColor: "#38bdf8",
  },
  preparing: {
    status: "dispatched",
    label: "Marcar despachada",
    backgroundColor: "#ea580c",
    borderColor: "#fb923c",
  },
};

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);

const formatOrderNumber = (number: number) =>
  `#${String(number).padStart(4, "0")}`;

function openWhatsAppUrl(url: string) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

function formatElapsedTime(order: Order, now: number) {
  const start = new Date(order.receivedAt).getTime();
  const end = order.completedAt ? new Date(order.completedAt).getTime() : now;
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatReceivedAt(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

interface OrderCardProps {
  order: Order;
  now: number;
  updating: boolean;
  onUpdate: (id: string, input: UpdateOrderInput) => Promise<Order | null>;
  menuProducts: MenuProduct[];
}

interface OrdersPagination {
  date: string;
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

function OrderCard({ order, now, updating, onUpdate, menuProducts }: OrderCardProps) {
  const [deliveryFee, setDeliveryFee] = useState(
    formatDeliveryFee(order.deliveryFee)
  );
  const [deliveryError, setDeliveryError] = useState("");
  const [deliveryModalMessage, setDeliveryModalMessage] = useState<string | null>(
    null
  );
  const [editing, setEditing] = useState(false);
  const [editCustomer, setEditCustomer] = useState(order.customer);
  const [editObservations, setEditObservations] = useState(order.observations ?? "");
  const [editReason, setEditReason] = useState("");
  const [editItems, setEditItems] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.items.map((item) => [editItemKey(item.name, item.variant), item.quantity]))
  );
  const [editError, setEditError] = useState("");

  const numericDeliveryFee = parseDeliveryFee(deliveryFee);
  const whatsappUrl = useMemo(
    () => buildOrderWhatsAppUrl(order, order.deliveryFee),
    [order]
  );
  const whatsappDisabled =
    order.status === "dispatched" || order.status === "rejected";
  const deliveryActionBlocked = order.deliveryFee === null || order.deliveryFee < 0;
  const isFinal = order.status === "dispatched" || order.status === "rejected";
  const primaryAction = PRIMARY_ACTIONS[order.status];
  const statusColor = STATUS_COLORS[order.status];

  const saveDeliveryFee = async () => {
    if (numericDeliveryFee === null) {
      setDeliveryError("Ingresa un costo de domicilio válido.");
      return;
    }

    setDeliveryError("");
    const updatedOrder = await onUpdate(order.id, { deliveryFee: numericDeliveryFee });
    if (updatedOrder) setDeliveryFee(formatDeliveryFee(updatedOrder.deliveryFee));
  };

  const requireDeliveryFee = () => {
    if (!deliveryActionBlocked) return true;

    const message =
      order.deliveryFee === null
        ? "Falta registrar el valor del domicilio. Escribe el valor y pulsa Guardar."
        : "El costo del domicilio no puede ser negativo.";
    setDeliveryError(message);
    setDeliveryModalMessage(message);
    return false;
  };

  const handleStatusAction = async (status: OrderStatus) => {
    if (status !== "rejected" && !requireDeliveryFee()) return;

    const updatedOrder = await onUpdate(order.id, { status });
    if (updatedOrder && status === "dispatched") {
      openWhatsAppUrl(buildOrderWhatsAppUrl(
        updatedOrder,
        updatedOrder.deliveryFee,
        "dispatched"
      ));
    }
  };

  const saveOrderEdit = async () => {
    const items = Object.entries(editItems)
      .filter(([, quantity]) => quantity > 0)
      .map(([key, quantity]) => ({ ...splitEditItemKey(key), quantity }));

    if (items.length === 0) {
      setEditError("La orden debe conservar al menos un producto.");
      return;
    }
    setEditError("");
    setEditing(false);
    const updated = await onUpdate(order.id, {
      customer: editCustomer,
      items,
      observations: editObservations.trim() || null,
      editReason: editReason.trim() || undefined,
    });
    if (!updated) {
      setEditing(true);
      setEditError("No fue posible guardar la corrección. Inténtalo nuevamente.");
    }
  };

  return (
    <article
      className="rounded-2xl border-2 p-4 transition-colors"
      style={{
        borderColor: statusColor.accent,
        backgroundColor: "#201E1E",
        boxShadow: statusColor.shadow,
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#facc15]">
            Orden {formatOrderNumber(order.number)}
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            Recibida {formatReceivedAt(order.receivedAt)}
          </p>
        </div>
        <div className="text-right">
          <span
            className="inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider"
            style={{
              borderColor: statusColor.accent,
              backgroundColor: statusColor.surface,
              color: statusColor.text,
            }}
          >
            {STATUS_LABELS[order.status]}
          </span>
          <p className="mt-1.5 font-mono text-lg font-bold text-white">
            {formatElapsedTime(order, now)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 py-4">
        <section className="space-y-1.5 text-xs">
          <h2 className="text-lg font-black uppercase text-white">
            {order.customer.name}
          </h2>
          <p className="text-white/70">{order.customer.address}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={whatsappUrl}
              aria-disabled={whatsappDisabled}
              tabIndex={whatsappDisabled ? -1 : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (whatsappDisabled || !requireDeliveryFee()) return;
                openWhatsAppUrl(whatsappUrl);
              }}
              className="inline-flex items-center gap-2 font-bold text-emerald-300 underline decoration-emerald-400/50 underline-offset-4 hover:text-emerald-200"
            >
              WhatsApp +{order.customer.phone}
            </a>
            <a
              href={whatsappUrl}
              aria-label={
                whatsappDisabled
                  ? `Pedido ${formatOrderNumber(order.number)} ${
                      order.status === "rejected" ? "rechazado" : "despachado"
                    }`
                  : `Enviar pedido ${formatOrderNumber(order.number)} por WhatsApp`
              }
              aria-disabled={whatsappDisabled}
              tabIndex={whatsappDisabled ? -1 : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (whatsappDisabled || !requireDeliveryFee()) return;
                openWhatsAppUrl(whatsappUrl);
              }}
              style={{
                backgroundColor: "#25D366",
                borderColor: "#25D366",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                width: "max-content",
                height: "28px",
                padding: "4px 12px",
                fontSize: "10px",
                lineHeight: "1",
              }}
              className={`rounded-full border font-black uppercase tracking-wider shadow-lg transition hover:brightness-110 ${
                whatsappDisabled
                  ? "pointer-events-none cursor-not-allowed opacity-40 grayscale"
                  : ""
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{ width: "14px", height: "14px", flexShrink: 0, fill: "#ffffff" }}
              >
                <path d="M20.52 3.48A11.82 11.82 0 0 0 12.08 0C5.54 0 .22 5.32.22 11.86c0 2.09.55 4.13 1.59 5.93L.12 24l6.35-1.66a11.86 11.86 0 0 0 5.61 1.41h.01c6.54 0 11.86-5.32 11.86-11.86 0-3.17-1.23-6.14-3.43-8.41ZM12.09 21.7h-.01a9.84 9.84 0 0 1-5.02-1.37l-.36-.21-3.77.99 1.01-3.67-.23-.38a9.83 9.83 0 0 1-1.51-5.2C2.2 6.43 6.63 2 12.08 2a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.81-9.87 9.81Zm5.4-7.36c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.46-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
              </svg>
              Enviar pedido
            </a>
          </div>
          {order.observations && (
            <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-200/75">
                Observaciones de la edición del pedido
              </p>
              <p className="mt-1 whitespace-pre-line text-xs text-amber-100">
                {order.observations}
              </p>
            </div>
          )}
        </section>

        <section className="border-t border-white/10 pt-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
            Comanda
          </p>
          <ul className="space-y-1.5">
            {order.items.map((item) => (
              <li
                key={`${item.name}-${item.variant}`}
                className="flex items-start justify-between gap-3 text-xs text-white"
              >
                <span>
                  <strong>{item.quantity}x</strong> {item.name}
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${item.variant === "combo" ? "bg-[#facc15] text-[#201E1E]" : "bg-white/10 text-white/60"}`}>
                    {item.variant === "combo" ? "Combo" : "Individual"}
                  </span>
                </span>
                <span className="shrink-0 text-white/60">
                  {formatCOP(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-3 border-t border-white/10 pt-3">
        <div>
          <label
            htmlFor={`delivery-${order.id}`}
            className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-white/50"
          >
            Costo del domicilio
          </label>
          <div className="flex gap-2">
            <input
              id={`delivery-${order.id}`}
              type="text"
              inputMode="numeric"
              value={deliveryFee}
              onChange={(event) =>
                setDeliveryFee(formatDeliveryFee(event.target.value))
              }
              disabled={isFinal || updating}
              placeholder="$0"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#B03336] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={saveDeliveryFee}
              disabled={isFinal || updating}
              className="rounded-lg border border-white/20 px-3 py-2.5 text-[11px] font-black uppercase text-white transition duration-200 hover:-translate-y-0.5 hover:border-[#facc15] hover:bg-[#facc15]/10 hover:text-[#facc15] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
          {deliveryError && (
            <p role="alert" className="mt-2 text-xs text-red-300">
              {deliveryError}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="text-[11px] uppercase tracking-wider text-white/45">
            <p>Subtotal {formatCOP(order.subtotal)}</p>
            {order.discountAmount > 0 && order.campaign && (
              <p className="mt-1 text-[#facc15]">
                {order.campaign.name} ({order.discountPercent}%): -{formatCOP(order.discountAmount)}
              </p>
            )}
          </div>
          <p className="text-xl font-black text-[#facc15]">
            {formatCOP(
              order.subtotal -
                order.discountAmount +
                (numericDeliveryFee ?? order.deliveryFee ?? 0)
            )}
          </p>
        </div>
      </div>

      {primaryAction && (
        <div className="mt-4 grid gap-2">
          <div className={order.status === "received" ? "grid grid-cols-2 gap-2" : "grid"}>
            <button
              type="button"
              disabled={updating}
              onClick={() => void handleStatusAction(primaryAction.status)}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border px-3 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              aria-disabled={deliveryActionBlocked}
              style={{
                backgroundColor: primaryAction.backgroundColor,
                borderColor: primaryAction.borderColor,
                boxShadow: `0 10px 24px ${statusColor.surface}`,
                opacity: deliveryActionBlocked ? 0.55 : 1,
              }}
            >
              {primaryAction.label}
            </button>
            {order.status === "received" && (
              <button
                type="button"
                disabled={updating}
                onClick={() => setEditing(true)}
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#facc15] bg-[#facc15]/10 px-3 py-3 text-xs font-black uppercase tracking-wider text-[#facc15] transition hover:bg-[#facc15] hover:text-[#201E1E] disabled:opacity-50"
              >
                Editar
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={updating}
            onClick={() => void handleStatusAction("rejected")}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: "#f87171",
              backgroundColor: "rgba(248, 113, 113, 0.12)",
              color: "#fecaca",
            }}
          >
            Rechazar
          </button>
        </div>
      )}

      {editing && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-order-title-${order.id}`}
            className="mx-auto my-4 w-full max-w-2xl rounded-2xl border-2 border-[#facc15] bg-[#201E1E] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#facc15]">Orden {formatOrderNumber(order.number)}</p>
                <h2 id={`edit-order-title-${order.id}`} className="mt-1 text-xl font-black uppercase">Corregir pedido</h2>
              </div>
              <button type="button" aria-label="Cerrar edición" onClick={() => setEditing(false)} className="text-2xl text-white/60">×</button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-white/70">Cliente
                <input value={editCustomer.name} onChange={(event) => setEditCustomer({ ...editCustomer, name: event.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white" />
              </label>
              <label className="text-xs font-bold text-white/70">Teléfono
                <input value={editCustomer.phone} onChange={(event) => setEditCustomer({ ...editCustomer, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white" />
              </label>
              <label className="text-xs font-bold text-white/70 sm:col-span-2">Dirección
                <input value={editCustomer.address} onChange={(event) => setEditCustomer({ ...editCustomer, address: event.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white" />
              </label>
            </div>

            <fieldset className="mt-5 border-t border-white/10 pt-4">
              <legend className="text-xs font-black uppercase tracking-wider text-white/60">Productos</legend>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                {menuProducts.flatMap((product) => {
                  const options = [
                    { variant: "individual" as const, label: "Individual", price: product.individualPrice },
                    ...(product.comboPrice === null ? [] : [{ variant: "combo" as const, label: "Combo", price: product.comboPrice }]),
                  ];
                  return options.map((option) => {
                    const key = editItemKey(product.name, option.variant);
                    return (
                      <label key={`${product.id}-${option.variant}`} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${option.variant === "combo" ? "border-[#facc15]/40 bg-[#facc15]/5" : "border-white/10 bg-black/20"}`}>
                        <span>{product.name} <strong className={option.variant === "combo" ? "text-[#facc15]" : "text-white/60"}>{option.label}</strong> <span className="text-white/40">{formatCOP(option.price)}</span></span>
                        <input aria-label={`${product.name} ${option.label}`} type="number" min="0" max="99" value={editItems[key] ?? 0} onChange={(event) => setEditItems({ ...editItems, [key]: Math.max(0, Number(event.target.value) || 0) })} className="w-16 rounded border border-white/20 bg-black/50 px-2 py-1 text-center text-white" />
                      </label>
                    );
                  });
                })}
              </div>
            </fieldset>

            <label className="mt-4 block text-xs font-bold text-white/70">Observaciones de la edición del pedido
              <textarea value={editObservations} maxLength={500} onChange={(event) => setEditObservations(event.target.value)} placeholder="Describe aquí las correcciones o indicaciones actualizadas del pedido" className="mt-1 min-h-20 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white" />
            </label>
            <label className="mt-3 block text-xs font-bold text-white/70">Motivo de la edición (opcional)
              <input value={editReason} maxLength={240} onChange={(event) => setEditReason(event.target.value)} placeholder="Ej. El cliente reportó un producto incorrecto" className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white" />
            </label>
            {editError && <p role="alert" className="mt-3 text-xs text-red-300">{editError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-white/20 px-4 py-2 text-xs font-black uppercase">Cancelar</button>
              <button type="button" disabled={updating} onClick={() => void saveOrderEdit()} className="rounded-lg border border-[#facc15] bg-[#facc15] px-4 py-2 text-xs font-black uppercase text-[#201E1E] disabled:opacity-50">Guardar corrección</button>
            </div>
          </div>
        </div>
      )}

      {deliveryModalMessage && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeliveryModalMessage(null);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`delivery-modal-title-${order.id}`}
            className="w-full max-w-md rounded-2xl border-2 border-[#B03336] bg-[#201E1E] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#facc15]">
                  Orden {formatOrderNumber(order.number)}
                </p>
                <h2
                  id={`delivery-modal-title-${order.id}`}
                  className="mt-1 text-xl font-black uppercase text-white"
                >
                  Falta el domicilio
                </h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={() => setDeliveryModalMessage(null)}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-lg font-bold text-white/70 transition hover:border-[#facc15] hover:text-[#facc15]"
              >
                ×
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/80">
              {deliveryModalMessage}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setDeliveryModalMessage(null)}
                className="rounded-lg border border-[#facc15] bg-[#facc15]/10 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#facc15] transition hover:bg-[#facc15] hover:text-[#201E1E]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function KitchenPage({ role }: { role: "admin" | "kitchen" }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuProducts, setMenuProducts] = useState<MenuProduct[]>([]);
  const [authState, setAuthState] = useState<
    "checking" | "authenticated" | "unauthenticated"
  >("checking");
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [exportFromDate, setExportFromDate] = useState(() => getTodayInColombia());
  const [exportUntilDate, setExportUntilDate] = useState(() => getTodayInColombia());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;

    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          authenticated?: boolean;
          error?: string;
        };

        if (!active) return;

        if (!response.ok) {
          setError(payload.error || "No fue posible validar la sesión.");
          setAuthState("unauthenticated");
          return;
        }

        if (!payload.authenticated) {
          window.location.replace("/cocina/login");
          return;
        }

        setAuthState("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setError("No fue posible validar la sesión.");
        setAuthState("unauthenticated");
      });

    return () => {
      active = false;
    };
  }, []);

  const loadOrders = useCallback(async (requestedPage = page) => {
    if (requestedPage !== page) setPageLoading(true);

    try {
      const query = new URLSearchParams({
        date: getTodayInColombia(),
        page: String(requestedPage),
        pageSize: "12",
      });
      const response = await fetch(`/api/orders?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        orders?: Order[];
        pagination?: OrdersPagination;
        error?: string;
      };

      if (response.status === 401) {
        window.location.replace("/cocina/login");
        return;
      }

      if (!response.ok || !payload.orders) {
        throw new Error(payload.error || "No fue posible consultar las órdenes.");
      }

      setOrders(payload.orders);
      setPage(payload.pagination?.page ?? requestedPage);
      setHasNextPage(payload.pagination?.hasNextPage ?? false);
      setTotalOrders(payload.pagination?.total ?? payload.orders.length);
      setError("");
      setLastUpdatedAt(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible consultar las órdenes."
      );
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (authState !== "authenticated") return;

    void fetch("/api/menu", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          categories?: Array<{ products: MenuProduct[] }>;
        };
        if (response.ok && payload.categories) {
          setMenuProducts(
            payload.categories.flatMap((category) => category.products)
          );
        }
      })
      .catch(() =>
        setError("No fue posible cargar el menú para editar órdenes.")
      );

    const initialLoad = window.setTimeout(() => void loadOrders(), 0);
    const polling = window.setInterval(() => void loadOrders(), 4000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(polling);
    };
  }, [authState, loadOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const updateOrder = async (id: string, input: UpdateOrderInput) => {
    setUpdatingIds((current) => new Set(current).add(id));
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as {
        order?: Order;
        error?: string;
      };

      if (response.status === 401) {
        window.location.replace("/cocina/login");
        return null;
      }

      if (!response.ok || !payload.order) {
        throw new Error(payload.error || "No fue posible actualizar la orden.");
      }

      setOrders((current) =>
        current.map((order) => (order.id === id ? payload.order! : order))
      );
      setError("");
      return payload.order;
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No fue posible actualizar la orden."
      );
      return null;
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/cocina/login");
  }

  async function downloadConsolidatedOrders() {
    if (exportFromDate > exportUntilDate) {
      setError("La fecha Desde no puede ser posterior a la fecha Hasta.");
      return;
    }

    setExporting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/orders/export?from=${encodeURIComponent(exportFromDate)}&until=${encodeURIComponent(exportUntilDate)}`,
        { cache: "no-store" }
      );

      if (response.status === 401) {
        window.location.replace("/cocina/login");
        return;
      }

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "No fue posible descargar el consolidado.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ordenes-${exportFromDate}-a-${exportUntilDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No fue posible descargar el consolidado."
      );
    } finally {
      setExporting(false);
    }
  }

  if (authState !== "authenticated") {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#0b0b0b] px-4 text-white"
      >
        <p className="text-sm text-white/60">
          {authState === "checking" ? "Validando acceso..." : error}
        </p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen text-white selection:bg-[#B03336]"
      style={{ backgroundColor: "#0b0b0b" }}
    >
      <header className="border-b border-[#B03336]/60 bg-black px-4 py-4">
        <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src="/images/Logo-Portal.png"
              width={64}
              height={64}
              alt="Logo de Portal ST"
              loading="eager"
              className="h-16 w-16 rounded-full object-cover"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#facc15]">
                Portal ST
              </p>
              <h1 className="mt-1 text-2xl font-black uppercase tracking-tight sm:text-3xl">
                Terminal de cocina
              </h1>
              <p className="mt-1 text-xs text-white/50">
                Las órdenes se actualizan cada cuatro segundos.
              </p>
            </div>
          </div>
          <div className="flex items-end gap-4 text-right text-xs text-white/45">
            <div>
              <p>{totalOrders} órdenes del día</p>
              <p className="mt-1">
                {lastUpdatedAt
                  ? `Actualizado ${lastUpdatedAt.toLocaleTimeString("es-CO")}`
                  : "Esperando actualización"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:border-red-300 hover:text-red-200"
            >
              Cerrar sesión
            </button>
            <a
              href="/cuenta"
              className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:border-[#facc15] hover:text-[#facc15]"
            >
              Mi cuenta
            </a>
            {role === "admin" && (
              <a
                href="/admin"
                className="rounded-lg border border-[#facc15]/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#facc15] transition hover:bg-[#facc15]/10"
              >
                Administrar menú
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1920px] px-4 py-4">
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {loading ? (
          <section
            className="rounded-2xl border px-6 py-20 text-center"
            style={{
              backgroundColor: "#171717",
              borderColor: "#3f3f46",
            }}
          >
            <p className="text-white/60">Consultando órdenes...</p>
          </section>
        ) : orders.length === 0 ? (
          <section
            className="rounded-2xl border border-dashed px-6 py-20 text-center"
            style={{
              backgroundColor: "#171717",
              borderColor: "#52525b",
            }}
          >
            <p className="text-xl font-black uppercase text-white/70">
              Aún no hay órdenes
            </p>
            <p className="mt-2 text-sm text-white/40">
              Los pedidos confirmados desde /menu aparecerán aquí.
            </p>
          </section>
        ) : (
          <section className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <OrderCard
                key={`${order.id}:${order.deliveryFee ?? "unset"}`}
                order={order}
                now={now}
                updating={updatingIds.has(order.id)}
                onUpdate={updateOrder}
                menuProducts={menuProducts}
              />
            ))}
          </section>
        )}

        {!loading && orders.length > 0 && (page > 1 || hasNextPage) && (
          <nav
            aria-label="Paginación de órdenes del día"
            className="mt-6 flex items-center justify-center gap-3"
          >
            <button
              type="button"
              disabled={page <= 1 || pageLoading}
              onClick={() => {
                setPage(page - 1);
                void loadOrders(page - 1);
              }}
              className="rounded-lg border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Anteriores
            </button>
            <span className="text-xs font-bold text-white/60">
              Página {page}
            </span>
            <button
              type="button"
              disabled={!hasNextPage || pageLoading}
              onClick={() => {
                setPage(page + 1);
                void loadOrders(page + 1);
              }}
              className="rounded-lg border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Siguientes
            </button>
          </nav>
        )}

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#171717] px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              Consolidado histórico
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Descarga las comandas almacenadas entre dos fechas.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/60">
              Desde
              <input
                id="orders-export-from-date"
                type="date"
                value={exportFromDate}
                onChange={(event) => setExportFromDate(event.target.value)}
                className="rounded-lg border border-white/20 bg-black px-3 py-2 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#facc15]"
              />
            </label>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/60">
              Hasta
              <input
                id="orders-export-until-date"
                type="date"
                value={exportUntilDate}
                onChange={(event) => setExportUntilDate(event.target.value)}
                className="rounded-lg border border-white/20 bg-black px-3 py-2 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#facc15]"
              />
            </label>
            <button
              type="button"
              onClick={() => void downloadConsolidatedOrders()}
              disabled={exporting || !exportFromDate || !exportUntilDate}
              className="rounded-lg border border-[#facc15]/70 bg-[#facc15]/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#facc15] transition hover:bg-[#facc15]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {exporting ? "Generando..." : "Descargar CSV"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

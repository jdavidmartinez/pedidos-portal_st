"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildOrderWhatsAppUrl } from "@/lib/orders/whatsapp-link";
import type { Order, OrderStatus, UpdateOrderInput } from "@/types/order";

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
  onUpdate: (id: string, input: UpdateOrderInput) => Promise<void>;
}

function OrderCard({ order, now, updating, onUpdate }: OrderCardProps) {
  const [deliveryFee, setDeliveryFee] = useState(
    order.deliveryFee === null ? "" : String(order.deliveryFee)
  );
  const [deliveryError, setDeliveryError] = useState("");

  const parsedDeliveryFee = Number(deliveryFee);
  const numericDeliveryFee =
    deliveryFee.trim() === "" ||
    !Number.isFinite(parsedDeliveryFee) ||
    parsedDeliveryFee < 0
      ? null
      : Math.round(parsedDeliveryFee);
  const whatsappUrl = useMemo(
    () => buildOrderWhatsAppUrl(order, numericDeliveryFee),
    [numericDeliveryFee, order]
  );
  const isFinal = order.status === "dispatched" || order.status === "rejected";
  const primaryAction = PRIMARY_ACTIONS[order.status];
  const statusColor = STATUS_COLORS[order.status];

  const saveDeliveryFee = async () => {
    if (numericDeliveryFee === null) {
      setDeliveryError("Ingresa un costo de domicilio válido.");
      return;
    }

    setDeliveryError("");
    await onUpdate(order.id, { deliveryFee: numericDeliveryFee });
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
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-bold text-emerald-300 underline decoration-emerald-400/50 underline-offset-4 hover:text-emerald-200"
          >
            WhatsApp +{order.customer.phone}
          </a>
          {order.observations && (
            <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-200/75">
                Observaciones
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
                key={item.name}
                className="flex items-start justify-between gap-3 text-xs text-white"
              >
                <span>
                  <strong>{item.quantity}x</strong> {item.name}
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
              type="number"
              inputMode="numeric"
              min="0"
              step="500"
              value={deliveryFee}
              onChange={(event) => setDeliveryFee(event.target.value)}
              disabled={isFinal || updating}
              placeholder="Ej. 5000"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#B03336] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={saveDeliveryFee}
              disabled={isFinal || updating}
              className="rounded-lg border border-white/20 px-3 py-2.5 text-[11px] font-black uppercase text-white transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-40"
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
          <p className="text-[11px] uppercase tracking-wider text-white/45">
            Subtotal {formatCOP(order.subtotal)}
          </p>
          <p className="text-xl font-black text-[#facc15]">
            {formatCOP(
              order.subtotal +
                (numericDeliveryFee ?? order.deliveryFee ?? 0)
            )}
          </p>
        </div>
      </div>

      {primaryAction && (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={updating}
            onClick={() =>
              onUpdate(order.id, { status: primaryAction.status })
            }
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: primaryAction.backgroundColor,
              borderColor: primaryAction.borderColor,
              boxShadow: `0 10px 24px ${statusColor.surface}`,
            }}
          >
            {primaryAction.label}
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => onUpdate(order.id, { status: "rejected" })}
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
    </article>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const payload = (await response.json()) as {
        orders?: Order[];
        error?: string;
      };

      if (!response.ok || !payload.orders) {
        throw new Error(payload.error || "No fue posible consultar las órdenes.");
      }

      setOrders(payload.orders);
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
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadOrders(), 0);
    const polling = window.setInterval(() => void loadOrders(), 4000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(polling);
    };
  }, [loadOrders]);

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

      if (!response.ok || !payload.order) {
        throw new Error(payload.error || "No fue posible actualizar la orden.");
      }

      setOrders((current) =>
        current.map((order) => (order.id === id ? payload.order! : order))
      );
      setError("");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No fue posible actualizar la orden."
      );
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

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
          <div className="text-right text-xs text-white/45">
            <p>{orders.length} órdenes en esta sesión</p>
            <p className="mt-1">
              {lastUpdatedAt
                ? `Actualizado ${lastUpdatedAt.toLocaleTimeString("es-CO")}`
                : "Esperando actualización"}
            </p>
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
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

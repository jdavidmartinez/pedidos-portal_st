const deliveryFeeFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

export function parseDeliveryFee(value: string | number | null) {
  if (value === null || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }

  if (value.includes("-")) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function formatDeliveryFee(value: string | number | null) {
  const parsed = parseDeliveryFee(value);
  if (parsed === null) return "";

  return deliveryFeeFormatter.format(parsed).replace(/\u00a0/g, "");
}

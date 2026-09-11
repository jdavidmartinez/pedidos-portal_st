// Quote/escape every cell and mark formula-like strings as literal text.
// Leading whitespace/control characters can otherwise hide a formula prefix.
const unsafeTextPrefix = /^[\s\p{Cc}\p{Cf}]*[=+\-@＝＋－＠\p{Cc}]/u;

export function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  const literal = typeof value === "string" && unsafeTextPrefix.test(value)
    ? `'${text}`
    : text;
  return `"${literal.replaceAll('"', '""')}"`;
}

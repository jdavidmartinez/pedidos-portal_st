export const COLOMBIA_TIME_ZONE = "America/Bogota";

export class InvalidOrderDateError extends Error {
  constructor() {
    super("La fecha debe tener el formato YYYY-MM-DD y ser válida.");
    this.name = "InvalidOrderDateError";
  }
}

function getDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COLOMBIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getTodayInColombia() {
  return getDateParts(new Date());
}

/**
 * Colombia observes UTC-5 without daylight-saving changes. Keeping the
 * conversion here makes the database range explicit and prevents the server
 * timezone from changing what the kitchen considers "today".
 */
export function getColombiaDateRange(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidOrderDateError();
  }

  const [year, month, day] = value.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new InvalidOrderDateError();
  }

  const from = new Date(`${value}T05:00:00.000Z`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}


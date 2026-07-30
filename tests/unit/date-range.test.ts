import { describe, expect, it } from "vitest";
import {
  getColombiaDateRange,
  getColombiaDateRangeBetween,
  InvalidOrderDateError,
  InvalidOrderDateRangeError,
} from "@/lib/orders/date-range";

describe("getColombiaDateRange", () => {
  it("convierte un día de Colombia a un rango UTC de 24 horas", () => {
    const { from, to } = getColombiaDateRange("2026-07-29");

    expect(from.toISOString()).toBe("2026-07-29T05:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-30T05:00:00.000Z");
  });

  it("rechaza fechas con formato inválido o imposibles", () => {
    expect(() => getColombiaDateRange("29-07-2026")).toThrow(
      InvalidOrderDateError
    );
    expect(() => getColombiaDateRange("2026-02-30")).toThrow(
      InvalidOrderDateError
    );
  });

  it("convierte un rango inclusivo de fechas de Colombia", () => {
    const { from, to } = getColombiaDateRangeBetween("2026-07-29", "2026-07-31");

    expect(from.toISOString()).toBe("2026-07-29T05:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-01T05:00:00.000Z");
  });

  it("rechaza un rango cuya fecha inicial es posterior", () => {
    expect(() =>
      getColombiaDateRangeBetween("2026-07-31", "2026-07-29")
    ).toThrow(InvalidOrderDateRangeError);
  });
});

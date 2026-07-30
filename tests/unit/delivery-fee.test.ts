import { describe, expect, it } from "vitest";
import {
  formatDeliveryFee,
  parseDeliveryFee,
} from "@/lib/orders/delivery-fee";

describe("delivery fee formatting", () => {
  it("parses formatted values and keeps zero explicit", () => {
    expect(parseDeliveryFee("$7.000")).toBe(7000);
    expect(parseDeliveryFee("0")).toBe(0);
    expect(parseDeliveryFee(0)).toBe(0);
    expect(parseDeliveryFee("-1000")).toBeNull();
    expect(parseDeliveryFee("")).toBeNull();
  });

  it("formats pesos colombianos without decimal fractions", () => {
    expect(formatDeliveryFee(7000)).toBe("$7.000");
    expect(formatDeliveryFee("$12500")).toBe("$12.500");
    expect(formatDeliveryFee(0)).toBe("$0");
  });
});

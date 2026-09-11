import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/orders/csv-cell";

describe("CSV literal text protection", () => {
  it.each([
    "=1+1", "+1+1", "-1+1", "@SUM(1,1)",
    "＝1+1", "＋1+1", "－1+1", "＠SUM(1,1)",
    "\t=1+1", "\r=1+1", "\n=1+1", "\tCustomer",
    "  =1+1", "\u00a0+1+1", "\u0000=1+1", "\u200b=1+1",
    "+573000000001",
  ])("exports %j as text", (input) => {
    expect(csvCell(input)).toBe(`"'${input}"`);
  });

  it.each([
    [15000, '"15000"'], [0, '"0"'], [-1500, '"-1500"'], [12.5, '"12.5"'],
    [null, '""'], ["", '""'], ["María Pérez", '"María Pérez"'],
    ["Calle 10 # 20-30", '"Calle 10 # 20-30"'],
    ["Sin cebolla\nSalsa aparte", '"Sin cebolla\nSalsa aparte"'],
    ['Cliente, "Portal"', '"Cliente, ""Portal"""'],
  ])("preserves ordinary and numeric value %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it("keeps separators and embedded quotes inside the original cell", () => {
    expect(csvCell('=1+1";=1+1,\r\n=2+2')).toBe('"\'=1+1"";=1+1,\r\n=2+2"');
    expect(csvCell('Cliente",=1+1')).toBe('"Cliente"",=1+1"');
  });
});

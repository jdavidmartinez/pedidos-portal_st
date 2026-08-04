import { describe, expect, it } from "vitest";
import {
  MAX_MENU_IMAGE_BYTES,
  safeMenuImageName,
  validateMenuImage,
} from "@/lib/menu/menu-image-upload";

describe("menu image upload", () => {
  it("accepts supported images within the limit", () => {
    expect(validateMenuImage({ type: "image/webp", size: 1024 })).toBeNull();
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateMenuImage({ type: "image/svg+xml", size: 1024 })).toContain("JPEG");
    expect(validateMenuImage({ type: "image/png", size: MAX_MENU_IMAGE_BYTES + 1 })).toContain("4 MB");
  });

  it("creates a safe pathname while preserving the extension", () => {
    expect(safeMenuImageName("Alitas BBQ (Promoción).WEBP")).toBe("alitas-bbq-promocion.webp");
    expect(safeMenuImageName("!!.png")).toBe("producto.png");
  });
});

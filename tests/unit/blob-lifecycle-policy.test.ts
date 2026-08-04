import { describe, expect, it } from "vitest";
import { buildBlobInventory, normalizeBlobUrl } from "@/lib/blob/blob-lifecycle-policy";

const now = new Date("2026-08-03T12:00:00.000Z");

describe("Blob lifecycle policy", () => {
  it("normalizes query strings before comparing references", () => {
    expect(normalizeBlobUrl("https://store.test/image.webp?v=2#preview")).toBe("https://store.test/image.webp");
  });

  it("never deletes referenced images, including shared references", () => {
    const url = "https://store.test/menu-products/shared.webp";
    const inventory = buildBlobInventory([
      { pathname: "menu-products/shared.webp", url, size: 100, uploadedAt: new Date("2026-01-01") },
    ], new Map([[url, 2]]), new Map(), now);

    expect(inventory[0]).toMatchObject({ referenceCount: 2, orphaned: false, eligibleForDeletion: false });
  });

  it("keeps recent orphans and permits deletion after 30 days", () => {
    const inventory = buildBlobInventory([
      { pathname: "campaigns/recent.webp", url: "https://store.test/recent.webp", size: 100, uploadedAt: new Date("2026-07-20") },
      { pathname: "campaigns/old.webp", url: "https://store.test/old.webp", size: 200, uploadedAt: new Date("2026-06-01") },
    ], new Map(), new Map([
      ["https://store.test/recent.webp", new Date("2026-07-20")],
      ["https://store.test/old.webp", new Date("2026-06-01")],
    ]), now);

    expect(inventory[0].eligibleForDeletion).toBe(false);
    expect(inventory[1].eligibleForDeletion).toBe(true);
  });
});

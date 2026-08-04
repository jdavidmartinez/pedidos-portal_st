import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cleanup = vi.hoisted(() => ({
  deleteEligibleOrphanedBlobs: vi.fn(),
}));

vi.mock("@/lib/blob/blob-lifecycle", () => cleanup);

import { GET } from "@/app/api/cron/blob-cleanup/route";

function cronRequest(secret?: string) {
  return new Request("http://test.local/api/cron/blob-cleanup", {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("scheduled Blob cleanup route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret";
    cleanup.deleteEligibleOrphanedBlobs.mockReset();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("does not run when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(cronRequest());

    expect(response.status).toBe(503);
    expect(cleanup.deleteEligibleOrphanedBlobs).not.toHaveBeenCalled();
  });

  it("rejects requests without the matching bearer token", async () => {
    const response = await GET(cronRequest("incorrect-secret"));

    expect(response.status).toBe(401);
    expect(cleanup.deleteEligibleOrphanedBlobs).not.toHaveBeenCalled();
  });

  it("deletes only lifecycle-eligible files when authorized", async () => {
    cleanup.deleteEligibleOrphanedBlobs.mockResolvedValue({
      deleted: 2,
      urls: ["https://store.test/one.webp", "https://store.test/two.webp"],
    });
    const response = await GET(cronRequest("cron-test-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, deleted: 2 });
    expect(cleanup.deleteEligibleOrphanedBlobs).toHaveBeenCalledOnce();
  });

  it("reports an internal failure without exposing details", async () => {
    cleanup.deleteEligibleOrphanedBlobs.mockRejectedValue(new Error("Blob unavailable"));
    const response = await GET(cronRequest("cron-test-secret"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "No fue posible completar la limpieza programada.",
    });
  });
});

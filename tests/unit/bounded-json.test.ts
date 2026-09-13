import { afterEach, expect, it, vi } from "vitest";
import { readBoundedJson } from "@/lib/http/bounded-json";

afterEach(() => vi.useRealTimers());

it("reads valid JSON and counts UTF-8 bytes", async () => {
  const body = JSON.stringify({ text: "ñ" });
  const size = new TextEncoder().encode(body).byteLength;
  expect(await readBoundedJson(new Request("http://test", { method: "POST", body }), size)).toEqual({ text: "ñ" });
  await expect(readBoundedJson(new Request("http://test", { method: "POST", body }), size - 1)).rejects.toMatchObject({ status: 413 });
});

it.each([undefined, "1"])("rejects actual bytes beyond the cap with content-length %s", async (length) => {
  const cancel = vi.fn();
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(9)); controller.enqueue(new Uint8Array(9)); }, cancel,
  });
  const request = new Request("http://test", { method: "POST", body, duplex: "half", headers: length ? { "Content-Length": length } : {} } as RequestInit);
  await expect(readBoundedJson(request, 10)).rejects.toMatchObject({ status: 413 });
  expect(cancel).toHaveBeenCalled();
});

it("rejects declared oversize without reading the stream", async () => {
  const request = new Request("http://test", { method: "POST", body: "{}", headers: { "Content-Length": "999" } });
  await expect(readBoundedJson(request, 10)).rejects.toMatchObject({ status: 413 });
  expect(request.bodyUsed).toBe(false);
});

it.each(["", "{bad", "not-json"])("rejects malformed JSON %j", async body => {
  await expect(readBoundedJson(new Request("http://test", { method: "POST", body }))).rejects.toMatchObject({ status: 400 });
});

it("cancels a stalled upload at its deadline", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const request = new Request("http://test", { method: "POST", body: new ReadableStream({ cancel }), duplex: "half" } as RequestInit);
  const assertion = expect(readBoundedJson(request)).rejects.toMatchObject({ status: 408 });
  await vi.advanceTimersByTimeAsync(10000);
  await assertion;
  expect(cancel).toHaveBeenCalled();
});

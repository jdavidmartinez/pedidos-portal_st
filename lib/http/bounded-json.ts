import { RequestError } from "./request-error";

export const PUBLIC_BODY_MAX_BYTES = 96 * 1024;
const BODY_TIMEOUT_MS = 10_000;

// Count actual bytes; Content-Length alone cannot bound chunked or dishonest bodies.
export async function readBoundedJson(request: Request, maxBytes = PUBLIC_BODY_MAX_BYTES): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new RequestError("La solicitud es demasiado grande.", 413);
  }
  if (!request.body) throw new RequestError("La solicitud no contiene JSON válido.", 400);
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RequestError("La solicitud tardó demasiado en recibirse.", 408));
      void reader.cancel().catch(() => undefined);
    }, BODY_TIMEOUT_MS);
  });
  try {
    const read = async () => {
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          void reader.cancel().catch(() => undefined);
          throw new RequestError("La solicitud es demasiado grande.", 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch { throw new RequestError("La solicitud no contiene JSON válido.", 400); }
    };
    return await Promise.race([read(), timeout]);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

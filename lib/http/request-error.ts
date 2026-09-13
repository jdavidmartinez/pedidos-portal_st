export class RequestError extends Error {
  constructor(message: string, public status: number, public retryAfterSeconds?: number) {
    super(message);
    this.name = "RequestError";
  }
}

export function requestErrorResponse(error: RequestError) {
  return Response.json({ error: error.message }, {
    status: error.status,
    headers: {
      "Cache-Control": "no-store",
      ...(error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {}),
    },
  });
}

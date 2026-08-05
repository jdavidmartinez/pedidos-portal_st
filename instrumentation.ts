import type { Instrumentation } from "next";

export function register() {
  // Next.js necesita este export para activar el ciclo de instrumentación.
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportOperationalError } = await import("@/lib/observability/server");
  await reportOperationalError({
    event: "server.unhandled_error",
    operation: context.routePath,
    dependency: "application",
    status: 500,
    error,
    route: request.path.split("?")[0],
    requestId: typeof request.headers["x-vercel-id"] === "string"
      ? request.headers["x-vercel-id"]
      : null,
  });
};

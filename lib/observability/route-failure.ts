import "server-only";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import { KitchenAuthConfigError } from "@/lib/auth/kitchen-auth";
import { reportOperationalError } from "./server";
import { OrderEditPersistenceError } from "@/lib/orders/order-repository";

export function routeFailureStatus(error: unknown) {
  return error instanceof KitchenAuthConfigError || error instanceof DatabaseNotConfiguredError ? 503 : 500;
}

export async function reportRouteFailure(
  error: unknown,
  operation: string,
  route: string,
  request?: Request,
) {
  const editFailure = error instanceof OrderEditPersistenceError;
  const failureOperation = editFailure ? "orders.edit" : operation;
  await reportOperationalError({
    event: `${failureOperation}_failed`, operation: failureOperation, route,
    dependency: error instanceof KitchenAuthConfigError ? "auth" : "neon",
    status: routeFailureStatus(error),
    error: editFailure ? error.cause : error,
    requestId: request?.headers.get("x-vercel-id"),
  });
}

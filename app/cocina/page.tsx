import { redirect } from "next/navigation";
import { getKitchenSession, hasRole } from "@/lib/auth/kitchen-auth";
import KitchenClient from "./kitchen-client";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const session = await getKitchenSession().catch(() => null);
  if (!session || !hasRole(session, ["admin", "kitchen"])) {
    redirect("/cocina/login");
  }

  return <KitchenClient role={session.role} />;
}

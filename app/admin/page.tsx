import { redirect } from "next/navigation";
import { getKitchenSession } from "@/lib/auth/kitchen-auth";
import AdminMenuClient from "./admin-menu-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getKitchenSession().catch(() => null);

  if (!session) {
    redirect("/cocina/login?next=/admin");
  }

  return <AdminMenuClient username={session.username} />;
}

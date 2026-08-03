import { redirect } from "next/navigation";
import { getKitchenSession, hasRole } from "@/lib/auth/kitchen-auth";
import AdminUsersClient from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getKitchenSession().catch(() => null);
  if (!session) redirect("/cocina/login?next=/admin");
  if (!hasRole(session, ["admin"])) redirect("/cocina");
  return <AdminUsersClient currentUserId={session.userId} />;
}

import { redirect } from "next/navigation";
import { getKitchenSession } from "@/lib/auth/kitchen-auth";
import ChangePasswordClient from "./change-password-client";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getKitchenSession().catch(() => null);
  if (!session) redirect("/cocina/login");
  return <ChangePasswordClient username={session.username} role={session.role} />;
}

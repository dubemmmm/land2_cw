import AppShell from "@/components/AppShell";
import { requireAdminPage } from "@/lib/auth";
import { listUsers } from "@/lib/userStore";
import AccountsAdminClient from "./AccountsAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts — Squaremeter by CW" };

export default async function AdminAccountsPage() {
  await requireAdminPage("/admin/accounts");
  const users = await listUsers();
  return (
    <AppShell active="accounts">
      <AccountsAdminClient initialUsers={users} />
    </AppShell>
  );
}

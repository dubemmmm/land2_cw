import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { requireUserPage } from "@/lib/auth";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account — Squaremeter by CW" };

export default async function AccountPage() {
  const user = await requireUserPage("/account");
  return (
    <>
      <SiteNav />
      <main className="acct-page">
        <div className="cw-container acct-container">
          <AccountClient initialUser={user} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

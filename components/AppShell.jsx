import Link from "next/link";
import AccountBadge from "@/components/AccountBadge";
import CommandBar from "@/components/CommandBar";
import { getAdminSession } from "@/lib/auth";
import { Compass, Database, FileText, LayoutDashboard, ListChecks, Radio, Users } from "lucide-react";

const items = [
  { href: "/listings", key: "listings", label: "Find land", icon: Compass, also: ["map"] },
  { href: "/dashboard", key: "dashboard", label: "Briefing", icon: LayoutDashboard },
  { href: "/reports", key: "reports", label: "Reports", icon: FileText },
  { href: "/signals", key: "signals", label: "Signals", icon: Radio },
  // Pages only the CW admin can open; buyers and agents are not shown them.
  // `barOnly` keeps an entry out of the phone tabs, which have room for six.
  { href: "/data/listings", key: "desk", label: "Listings desk", icon: ListChecks, adminOnly: true, barOnly: true },
  { href: "/data", key: "data", label: "Data", icon: Database, adminOnly: true, alsoOnPhone: ["desk"] },
  { href: "/admin/accounts", key: "accounts", label: "Accounts", icon: Users, adminOnly: true }
];

// The portal frame: a bar across the top with the sections spelled out, and on
// a phone the same sections as labelled tabs along the bottom.
// `bleed` lets a page run edge to edge under the bar.
export default async function AppShell({ active, bleed = false, children }) {
  const admin = await getAdminSession();
  const shown = items.filter((item) => admin || !item.adminOnly);
  const isActive = (item) => active === item.key || item.also?.includes(active);
  return (
    <div className="atlas">
      <header className="atlas-bar">
        <Link className="atlas-brand" href="/" aria-label="Squaremeter by CW home">
          <span className="cw-mark">CW</span>
          <b>Squaremeter</b>
        </Link>
        <nav className="atlas-nav" aria-label="Portal sections">
          {shown.map((item) => (
            <Link key={item.key} href={item.href} className={isActive(item) ? "active" : ""} aria-current={isActive(item) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="atlas-tools">
          <CommandBar variant="bar" />
          {admin ? <Link className="atlas-admin" href="/admin/login" title="Signed in as CW admin">Admin</Link> : null}
          <AccountBadge variant="rail" />
        </div>
      </header>
      <main className={bleed ? "atlas-main atlas-bleed" : "atlas-main page"}>{children}</main>
      <nav className="atlas-tabs" aria-label="Portal sections">
        {shown.filter((item) => !item.barOnly).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.key} href={item.href} className={isActive(item) || item.alsoOnPhone?.includes(active) ? "active" : ""} aria-current={isActive(item) ? "page" : undefined}>
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

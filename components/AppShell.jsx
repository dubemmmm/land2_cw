import Link from "next/link";
import AccountBadge from "@/components/AccountBadge";
import CommandBar from "@/components/CommandBar";
import { getAdminSession } from "@/lib/auth";
import { BarChart3, Database, FileText, Home, LayoutDashboard, Map, Settings, Users } from "lucide-react";

const items = [
  { href: "/dashboard", key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/listings", key: "listings", label: "Listings", icon: Home },
  { href: "/map", key: "map", label: "Map", icon: Map },
  { href: "/reports", key: "reports", label: "Reports", icon: FileText },
  { href: "/signals", key: "signals", label: "Signals", icon: BarChart3 },
  // Pages only the CW admin can open; buyers and agents are not shown them.
  { href: "/data", key: "data", label: "Data", icon: Database, adminOnly: true },
  { href: "/admin/accounts", key: "accounts", label: "Accounts", icon: Users, adminOnly: true }
];

export default async function AppShell({ active, children }) {
  const admin = await getAdminSession();
  const shown = items.filter((item) => admin || !item.adminOnly);
  return (
    <div className="app-shell">
      <aside className="rail">
        <Link className="logo" href="/" aria-label="Squaremeter by CW home" title="Squaremeter by CW home">CW</Link>
        <CommandBar />
        <nav aria-label="Main navigation">
          {shown.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                className={`rail-link ${active === item.key ? "active" : ""}`}
                href={item.href}
                aria-label={item.label}
                aria-current={active === item.key ? "page" : undefined}
                data-label={item.label}
                title={item.label}
              >
                <Icon size={21} />
              </Link>
            );
          })}
        </nav>
        <div className="rail-foot">
          {admin ? (
            <Link className="rail-link" href="/admin/login" aria-label="Admin session" data-label="Admin session" title="Admin session">
              <Settings size={21} />
            </Link>
          ) : null}
          <AccountBadge variant="rail" />
        </div>
      </aside>
      <main className="page">{children}</main>
    </div>
  );
}

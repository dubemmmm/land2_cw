import Link from "next/link";
import { BarChart3, Database, FileText, Home, LayoutDashboard, Map, Settings } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const items = [
  { href: "/dashboard", key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/listings", key: "listings", label: "Listings", icon: Home },
  { href: "/map", key: "map", label: "Map", icon: Map },
  { href: "/reports", key: "reports", label: "Reports", icon: FileText },
  { href: "/data", key: "data", label: "Data", icon: Database },
  { href: "/signals", key: "signals", label: "Signals", icon: BarChart3 }
];

export default function AppShell({ active, children }) {
  return (
    <div className="app-shell">
      <aside className="rail">
        <Link className="logo" href="/" aria-label="Square Meter home" title="Square Meter home">CW</Link>
        <nav aria-label="Main navigation">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                className={`rail-link ${active === item.key ? "active" : ""}`}
                href={item.href}
                aria-label={item.label}
                data-label={item.label}
                title={item.label}
              >
                <Icon size={21} />
              </Link>
            );
          })}
        </nav>
        <div className="rail-foot">
          <ThemeToggle />
          <Link className="rail-link" href="/admin/login" aria-label="Settings" data-label="Settings" title="Settings">
            <Settings size={21} />
          </Link>
          <span className="avatar">CO</span>
        </div>
      </aside>
      <main className="page">{children}</main>
    </div>
  );
}

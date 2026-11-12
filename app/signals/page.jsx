import Link from "next/link";
import { Bell, RadioTower, TrendingUp } from "lucide-react";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

const previews = [
  {
    label: "Live signal feed",
    title: "Planning alerts",
    text: "Height variance denied in Banana Island. Drainage review requested in Ikoyi.",
    icon: RadioTower
  },
  {
    label: "Market movement",
    title: "Price changes",
    text: "Victoria Island tracked above the prior average band. Lekki Phase 1 activity increased.",
    icon: TrendingUp
  },
  {
    label: "Client triggers",
    title: "Brief updates",
    text: "Notify clients when a saved neighborhood, estate, or listing changes materially.",
    icon: Bell
  }
];

export default function SignalsPage() {
  return (
    <AppShell active="signals">
      <div className="briefing">
        <header className="brief-header">
          <div>
            <nav className="cw-crumbs" aria-label="Breadcrumb">
              <Link href="/">Squaremeter</Link>
              <span aria-hidden="true">/</span>
              <span>Signals</span>
            </nav>
            <h1>Signals</h1>
            <p className="brief-header-lede">Live market, planning, listing and client-intelligence signals in one feed.</p>
          </div>
        </header>

        <section className="cw-cta-band signals-band">
          <div>
            <h2>Coming soon</h2>
            <p>This page will surface live market, planning, listing, and client-intelligence signals once the signal engine is ready.</p>
          </div>
          <Link className="cw-btn cw-btn-white" href="/dashboard">Back to dashboard</Link>
        </section>

        <section className="signals-grid" aria-label="Planned signal types">
          {previews.map((item, index) => {
            const Icon = item.icon;
            return (
              <article className="signals-card" key={item.title}>
                <div className="signals-card-top">
                  <p className="cw-label"><b>{String(index + 1).padStart(2, "0")}</b>{item.label}</p>
                  <span className="signals-icon"><Icon size={18} /></span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
                <span className="cw-chip">Example preview</span>
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}

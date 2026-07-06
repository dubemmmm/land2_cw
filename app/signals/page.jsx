import { Bell, RadioTower, TrendingUp } from "lucide-react";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function SignalsPage() {
  return (
    <AppShell active="signals">
      <section className="coming-soon-page">
        <div className="coming-soon-blur" aria-hidden="true">
          <article>
            <span><RadioTower size={18} /> Live signal feed</span>
            <h2>Planning alerts</h2>
            <p>Height variance denied in Banana Island. Drainage review requested in Ikoyi.</p>
          </article>
          <article>
            <span><TrendingUp size={18} /> Market movement</span>
            <h2>Price changes</h2>
            <p>Victoria Island tracked above the prior average band. Lekki Phase 1 activity increased.</p>
          </article>
          <article>
            <span><Bell size={18} /> Client triggers</span>
            <h2>Brief updates</h2>
            <p>Notify clients when a saved neighborhood, estate, or listing changes materially.</p>
          </article>
        </div>
        <div className="coming-soon-panel">
          <span>Signals</span>
          <h1>Coming soon</h1>
          <p>This page will surface live market, planning, listing, and client-intelligence signals once the signal engine is ready.</p>
        </div>
      </section>
    </AppShell>
  );
}

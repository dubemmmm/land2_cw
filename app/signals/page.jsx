import Link from "next/link";
import { Radio } from "lucide-react";
import AppShell from "@/components/AppShell";
import { requirePortalPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The feed is not built yet. The page shows the shape of it, blurred, with
// plain bars where the words will go, so nobody reads made-up signals as real.
const rows = [[62, 34, 22], [48, 26, 22], [78, 40, 16], [44, 36, 16], [70, 30, 28], [54, 28, 22]];

export default async function SignalsPage() {
  await requirePortalPage("/signals");
  return (
    <AppShell active="signals">
      <div className="briefing">
        <header className="cw-pagehead brief-head">
          <div>
            <nav className="cw-crumbs" aria-label="Breadcrumb">
              <Link href="/">Squaremeter</Link>
              <span aria-hidden="true">/</span>
              <span>Signals</span>
            </nav>
            <h1 className="cw-pagehead-title">Signals</h1>
            <p className="brief-head-date">Planning decisions, price movements and client alerts, listed as they happen.</p>
          </div>
          <div className="brief-actions">
            <Link className="cw-btn cw-btn-soft cw-btn-sm" href="/dashboard">Back to Briefing</Link>
          </div>
        </header>

        <section className="signals-soon" aria-labelledby="signals-soon-title">
          <div className="signals-ghost" aria-hidden="true">
            {rows.map((widths, index) => (
              <div className="signals-ghost-row" key={index}>
                {widths.map((width, cell) => <i style={{ width: `${width}%` }} key={cell} />)}
                <i className="signals-ghost-chip" />
              </div>
            ))}
          </div>
          <div className="signals-soon-card">
            <Radio size={22} aria-hidden="true" />
            <h2 id="signals-soon-title">Signals is coming soon</h2>
            <p>
              You will see planning decisions, price movements and changes to the places you follow here, as they happen.
              We are still building it.
            </p>
            <Link className="cw-btn cw-btn-navy cw-btn-sm" href="/listings">Browse land for sale</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

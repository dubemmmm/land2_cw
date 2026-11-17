import Link from "next/link";
import AppShell from "@/components/AppShell";
import { requirePortalPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Illustrative rows only: the signal feed is not live yet.
const examples = [
  { kind: "Planning", what: "Height variance denied", where: "Banana Island" },
  { kind: "Planning", what: "Drainage review requested", where: "Ikoyi" },
  { kind: "Price", what: "Price per m² tracked above the prior average band", where: "Victoria Island" },
  { kind: "Price", what: "Market activity increased", where: "Lekki Phase 1" },
  { kind: "Client alert", what: "A saved location, estate or listing changed materially", where: "Your saved items" }
];

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
            <Link className="cw-btn cw-btn-soft cw-btn-sm" href="/dashboard">Back to dashboard</Link>
          </div>
        </header>

        <p className="signals-notice">
          <strong>This feed is not live yet.</strong> The rows below are examples of what it will show once the signal engine is ready.
          Until then, the latest location signals are under <Link href="/dashboard">What changed on the dashboard</Link>.
        </p>

        <section className="brief-card" aria-labelledby="signals-title">
          <div className="brief-card-title">
            <div>
              <h2 id="signals-title">What a signal looks like</h2>
              <p>{examples.length} examples, not live data</p>
            </div>
          </div>
          <div className="brief-table-wrap">
            <table className="brief-table signals-table">
              <thead>
                <tr>
                  <th scope="col">What changed</th>
                  <th scope="col">Where</th>
                  <th scope="col">Type</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((item) => (
                  <tr key={`${item.what}-${item.where}`}>
                    <th scope="row">{item.what}</th>
                    <td>{item.where}</td>
                    <td>{item.kind}</td>
                    <td><span className="cw-chip">Example</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

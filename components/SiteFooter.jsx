import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="sq-footer">
      <div className="cw-container">
        <div className="sq-footer-block">
          <div className="sq-footer-brand">
            <span className="cw-mark">CW</span>
            <p>Squaremeter by CW. Lagos land, measured, priced and graded by the square metre.</p>
          </div>
          <div>
            <h4>Sheets</h4>
            <ul>
              <li><Link href="/#index">Price index</Link></li>
              <li><Link href="/listings">Plots for sale</Link></li>
              <li><Link href="/map">Map</Link></li>
              <li><Link href="/dashboard">Intelligence portal</Link></li>
            </ul>
          </div>
          <div>
            <h4>CW Real Estate</h4>
            <ul>
              <li><a href="https://cwlagos.com">cwlagos.com</a></li>
              <li><a href="https://offplan.cwlagos.com">CW Offplan</a></li>
              <li><a href="mailto:hello@cwlagos.com">hello@cwlagos.com</a></li>
            </ul>
          </div>
          <div>
            <h4>Title block</h4>
            <dl>
              <div><dt>Project</dt><dd>Squaremeter</dd></div>
              <div><dt>Drawn by</dt><dd>CW Real Estate</dd></div>
              <div><dt>Unit</dt><dd>1 m²</dd></div>
              <div><dt>Issue</dt><dd>{year}</dd></div>
            </dl>
          </div>
        </div>
        <p className="sq-footer-legal">
          © {year} Squaremeter by CW Real Estate. Figures are estimates drawn from tracked market data and may
          not reflect final transaction prices. They are not a substitute for legal, survey or valuation advice.
        </p>
      </div>
    </footer>
  );
}

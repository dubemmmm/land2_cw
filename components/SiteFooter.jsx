import Link from "next/link";

export default function SiteFooter({ note }) {
  const year = new Date().getFullYear();
  return (
    <footer className="sq-footer">
      <div className="cw-container">
        <div className="sq-footer-block">
          <div className="sq-footer-brand">
            <span className="cw-mark">CW</span>
            <p>Squaremeter is the land intelligence service of CW Real Estate, Lagos.</p>
          </div>
          <div>
            <h4>Squaremeter</h4>
            <ul>
              <li><Link href="/#prices">Prices by location</Link></li>
              <li><Link href="/listings">Plots for sale</Link></li>
              <li><Link href="/map">Map</Link></li>
              <li><Link href="/dashboard">Portal</Link></li>
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
        </div>
        <p className="sq-footer-legal">
          © {year} CW Real Estate. Prices are estimates from tracked market data and may differ from final
          transaction prices. They are not legal, survey or valuation advice.
        </p>
        {note ? <p className="sq-footer-legal">{note}</p> : null}
      </div>
    </footer>
  );
}

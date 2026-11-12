import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="cw-footer">
      <div className="cw-container">
        <div className="cw-footer-grid">
          <div className="cw-footer-brand">
            <span className="cw-mark">CW</span>
            <p>Squaremeter by CW. Land market intelligence for Lagos real estate.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link href="/#intelligence">Market intelligence</Link></li>
              <li><Link href="/listings">Land listings</Link></li>
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
        </div>
        <p className="cw-footer-legal">
          © {new Date().getFullYear()} Squaremeter by CW Real Estate. Figures shown are estimates based on tracked
          market data and may not reflect final transaction prices. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

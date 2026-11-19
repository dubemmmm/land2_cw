import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/drawings.css";
import "./styles/dashboard.css";
import "./styles/map.css";
import "./styles/detail.css";
import "./styles/reports.css";
import "./styles/data.css";
import "./styles/forms.css";
import "./styles/account.css";
import "./styles/listings.css";
import "./styles/landing.css";
import "./styles/responsive.css";
import "./styles/atlas.css";
import "./styles/desk.css";

export const metadata = {
  title: "Squaremeter by CW — Lagos land intelligence",
  description: "Land market intelligence, estate records and curated plots across Lagos, from CW Real Estate."
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@300,400,500,600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Instrument+Serif&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

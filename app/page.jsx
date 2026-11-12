import Link from "next/link";
import { ArrowRight, ArrowUpRight, BarChart3, Building2, Check, ShieldCheck } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getLandBibleInventory } from "@/lib/landBible";
import { getLandListings } from "@/lib/listingStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import { confidenceScore } from "@/lib/metrics";
import { getEstateMarketProfile, getLandMarketProfile, toEstateSlug } from "@/lib/landBible";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [neighborhoods, listings] = await Promise.all([getNeighborhoods(), getLandListings()]);
  const inventory = getLandBibleInventory();
  const estates = inventory.estates || [];
  const marketProfiles = neighborhoods
    .map((neighborhood) => ({ neighborhood, market: getLandMarketProfile(neighborhood.id) }))
    .filter((item) => item.market);
  const heroStats = buildHeroStats(neighborhoods, estates, marketProfiles);
  const insights = buildInsightCards(marketProfiles, estates);
  const marketTicker = buildMarketTicker(marketProfiles, estates);
  const featuredListings = listings
    .filter((listing) => listing.listingStatus === "Available")
    .slice(0, 3);
  const landUseDistribution = countBy(estates, (estate) => normalizeUse(estate.primary_use));
  const developmentDistribution = countBy(estates, (estate) => /built/i.test(estate.status || "") ? "Fully built" : "Developing");

  const [leadInsight, ...otherInsights] = insights;

  return (
    <main className="landing-page">
      <SiteNav />

      <section className="landing-hero-wrap" id="overview">
        <div className="landing-hero">
          <div className="landing-hero-copy">
            <h1><span>Invest in</span><span>Lagos land</span><span>with clarity.</span></h1>
            <p>
              Squaremeter helps clients understand where to buy land in Lagos, what each location is worth,
              what planning risks to check, and which live plots are ready for review.
            </p>
            <div className="landing-actions">
              <Link className="cw-btn cw-btn-white" href="/listings">View land listings <ArrowRight size={16} /></Link>
              <Link className="cw-btn cw-btn-ghost" href="#intelligence">Explore intelligence</Link>
            </div>
          </div>
          <div className="landing-hero-stats">
            {heroStats.map((stat) => (
              <article key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {marketTicker.length ? (
        <div className="landing-market-ticker" aria-label="Market price highlights">
          <div>
            {marketTicker.concat(marketTicker).map((item, index) => (
              <Link href={item.href} key={`${item.href}-${item.name}-${index}`}>
                <span>{item.name}</span>
                <strong>{item.price}</strong>
                <em>{item.growth}</em>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <section className="cw-section landing-explainer">
        <div className="cw-container">
          <div className="landing-split">
            <div className="landing-section-head">
              <p className="cw-label"><b>01</b>What Squaremeter does</p>
              <h2 className="cw-h2">A client-facing guide for land decisions before capital is committed.</h2>
              <p className="cw-lede">
                Land buying in Lagos is not just a price conversation. Clients need to compare locations,
                title documents, estate rules, price movement, development status, and approval risk.
                Squaremeter turns those fragmented checks into a clear briefing layer before you speak to
                vendors, agents, surveyors, or lawyers. It combines market intelligence, estate records,
                title context, and curated listings in one decision workspace.
              </p>
              <div className="landing-actions">
                <Link className="cw-btn cw-btn-navy" href="/listings">View land listings</Link>
                <Link className="cw-btn cw-btn-outline" href="#intelligence">Explore intelligence</Link>
              </div>
            </div>
            {leadInsight ? (
              <article className="cw-imgcard landing-feature-card">
                <span className="cw-chip cw-chip-glass">{leadInsight.label}</span>
                <div className="cw-imgcard-cap">
                  <strong>{leadInsight.title}</strong>
                  <span>{leadInsight.meta} · {leadInsight.badge}</span>
                </div>
              </article>
            ) : null}
          </div>
          <div className="landing-explainer-grid">
            <Feature icon={BarChart3} title="Market intelligence" text="Compare price per square meter, annual growth signals, mapped estate supply, and location confidence from the Land Bible and admin updates." />
            <Feature icon={Building2} title="Curated land listings" text="Browse available plots with size, use, asking price, estate context, status, and title-document indicators before requesting deeper diligence." />
            <Feature icon={ShieldCheck} title="Risk-aware decisions" text="See planning constraints, title status, approval history, and documents to request so attractive plots can be filtered through practical risk checks." />
          </div>
        </div>
      </section>

      <section className="cw-section landing-insights">
        <div className="cw-container">
          <div className="landing-section-head">
            <p className="cw-label"><b>02</b>Market signals</p>
            <h2 className="cw-h2">Where the tracked market stands today.</h2>
          </div>
          <div className="landing-insight-grid">
            {otherInsights.map((insight) => (
              <article className="cw-card" key={insight.label}>
                <span>{insight.label}</span>
                <h3>{insight.title}</h3>
                <p>{insight.meta}</p>
                <b className="cw-chip">{insight.badge}</b>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cw-section landing-analytics" id="intelligence">
        <div className="cw-container">
          <div className="landing-section-head">
            <p className="cw-label"><b>03</b>Market intelligence</p>
            <h2 className="cw-h2">Analytics that show how Lagos land supply is distributed.</h2>
            <p className="cw-lede">
              The intelligence layer tracks neighborhoods, estate development status, land-use patterns,
              price movement, and available inventory. These are directional decision tools, not a substitute
              for legal, survey, valuation, or planning verification.
            </p>
          </div>
          <div className="landing-chart-grid">
            <DonutPanel title="Land use distribution" total={estates.length} entries={landUseDistribution} />
            <DonutPanel title="Development status" total={estates.length} entries={developmentDistribution} />
          </div>
        </div>
      </section>

      <section className="cw-section landing-featured-listings">
        <div className="cw-container">
          <div className="landing-section-head inline">
            <div>
              <p className="cw-label"><b>04</b>Featured land listings</p>
              <h2 className="cw-h2">Live plots ready for client review.</h2>
              <p className="cw-lede">Start with available plots, then open the full listing page to filter by location, estate, use, price, and size.</p>
            </div>
            <Link className="cw-btn cw-btn-outline" href="/listings">See more <ArrowRight size={16} /></Link>
          </div>
          {featuredListings.length ? (
            <div className="landing-listing-grid">
              {featuredListings.map((listing) => (
                <Link className="cw-imgcard landing-listing-card" href="/listings" key={listing.id}>
                  {listing.photos?.[0] ? <img src={listing.photos[0]} alt="" /> : null}
                  <div className="landing-listing-tags">
                    <span className="cw-chip cw-chip-glass"><i className="cw-dot" />{listing.listingStatus}</span>
                    <span className="cw-chip cw-chip-navy">{formatCompactPrice(listing.askingPrice)}</span>
                  </div>
                  <div className="cw-imgcard-cap">
                    <strong>{listing.title}</strong>
                    <span>{formatNumber(listing.sizeSqm)} sqm · {listing.landUse}</span>
                    <span>{listing.neighborhoodName}{listing.estate ? ` · ${listing.estate}` : ""}</span>
                    {listing.titleDocument ? <em>{listing.titleDocument}</em> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="cw-card landing-empty">No plots are marked available right now. New listings appear here as soon as they are published.</p>
          )}
        </div>
      </section>

      <section className="cw-section landing-why" id="why-lagos">
        <div className="cw-container">
          <div className="landing-section-head">
            <p className="cw-label"><b>05</b>Why invest in Lagos</p>
            <h2 className="cw-h2">Land demand is supported by population, commerce, urban growth, and scarcity.</h2>
            <p className="cw-lede">
              Lagos concentrates people, jobs, ports, financial services, technology, retail, and premium
              residential demand. That creates long-term land pressure, but the best opportunities still
              depend on title quality, infrastructure, access, flood risk, estate rules, and realistic resale demand.
            </p>
          </div>
          <div className="landing-lagos-stats">
            {lagosStats.map((stat) => (
              <article key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>
          <div className="landing-reason-grid">
            {lagosReasons.map((reason, index) => (
              <article className="cw-card" key={reason.title}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <h3>{reason.title}</h3>
                <p>{reason.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cw-section cw-section-last landing-closing">
        <div className="cw-container landing-closing-grid">
          <article className="cw-card landing-explore-card">
            <p className="cw-label"><b>06</b>Explore</p>
            <h2 className="cw-h3">Use Squaremeter to compare Lagos land before you shortlist a plot.</h2>
            <nav aria-label="Explore Squaremeter">
              {exploreLinks.map((item) => (
                <Link href={item.href} key={item.href}>
                  <span><strong>{item.title}</strong><small>{item.text}</small></span>
                  <ArrowUpRight size={18} />
                </Link>
              ))}
            </nav>
          </article>
          <article className="landing-final-cta">
            <span>Ready to inspect the market?</span>
            <h2>Start with live plots, then check the ground around them.</h2>
            <ul>
              {closingChecks.map((item) => (
                <li key={item}><Check size={16} />{item}</li>
              ))}
            </ul>
            <div className="landing-actions">
              <Link className="cw-btn cw-btn-white" href="/listings">Browse listings</Link>
              <Link className="cw-btn cw-btn-ghost" href="/map">Open map</Link>
            </div>
          </article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <article className="cw-card">
      <i><Icon size={20} /></i>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

// CSS variable strings: they feed inline conic-gradient / legend swatch styles.
const chartColors = ["var(--navy)", "var(--gold)", "var(--navy-200)", "var(--green)", "var(--muted)"];

function DonutPanel({ title, total, entries }) {
  const colors = chartColors;
  const gradient = buildConic(entries, colors);
  return (
    <article className="cw-card landing-chart-panel">
      <h3>{title}</h3>
      <div className="landing-chart-body">
        <div className="landing-donut" style={{ background: gradient }}>
          <span><strong>{total}</strong><em>total</em></span>
        </div>
        <div className="landing-chart-legend">
          {entries.map((entry, index) => (
            <p key={entry.label}><i style={{ background: colors[index % colors.length] }} /><span>{entry.label}</span><b>{entry.count}</b></p>
          ))}
        </div>
      </div>
    </article>
  );
}

function buildHeroStats(neighborhoods, estates, marketProfiles) {
  const avgPrice = average(marketProfiles.map((item) => item.market.priceValue).filter(Boolean));
  const totalLand = estates.reduce((sum, estate) => sum + (Number(estate.total_land_sqm) || 0), 0);
  return [
    { label: "Neighborhoods", value: neighborhoods.length },
    { label: "Estates tracked", value: estates.length },
    { label: "Avg price / sqm", value: avgPrice ? formatPerSqm(avgPrice) : "Under review" },
    { label: "sqm mapped", value: totalLand ? `${Math.round(totalLand / 1000000)}M` : "Updating" }
  ];
}

function buildInsightCards(marketProfiles, estates) {
  const sortedGrowth = [...marketProfiles].sort((a, b) => (b.market.annualGrowth || 0) - (a.market.annualGrowth || 0));
  const sortedPrice = [...marketProfiles].filter((item) => item.market.priceValue).sort((a, b) => a.market.priceValue - b.market.priceValue);
  const premium = [...sortedPrice].reverse()[0];
  const developing = estates.filter((estate) => /develop/i.test(estate.status || "")).length;
  return [
    {
      label: "Top appreciating area",
      title: sortedGrowth[0]?.neighborhood.name || "Banana Island",
      meta: sortedGrowth[0]?.market.parentName || sortedGrowth[0]?.neighborhood.jurisdiction || "Tracked market",
      badge: `${sortedGrowth[0]?.market.annualGrowthLabel || "~15%"} est. annual growth`
    },
    {
      label: "Best entry point",
      title: sortedPrice[0]?.neighborhood.name || "Ajah",
      meta: sortedPrice[0]?.market.priceLabel || "Entry pricing under review",
      badge: "Lower entry band"
    },
    {
      label: "Premium market",
      title: premium?.neighborhood.name || "Ikoyi",
      meta: premium?.market.priceLabel || "Premium pricing under review",
      badge: `${premium?.market.annualGrowthLabel || "~15%"} est. annual growth`
    },
    {
      label: "Active developments",
      title: developing,
      meta: `of ${estates.length} estates developing`,
      badge: `${estates.length ? Math.round((developing / estates.length) * 100) : 0}% of tracked estates`
    }
  ];
}

function buildMarketTicker(marketProfiles, estates) {
  const neighborhoods = marketProfiles
    .filter((item) => item.market.priceLabel)
    .map((item) => ({
      name: item.neighborhood.name,
      price: cleanPriceLabel(item.market.priceLabel),
      growth: item.market.annualGrowthLabel && item.market.annualGrowthLabel !== "N/A" ? `${item.market.annualGrowthLabel}/yr` : "trend tracked",
      href: `/locations/${item.neighborhood.id}`
    }));
  const estateItems = estates
    .map((estate) => {
      const profile = getEstateMarketProfile(toEstateSlug(estate.id));
      if (!profile?.priceLabel) return null;
      return {
        name: estate.name,
        price: cleanPriceLabel(profile.priceLabel),
        growth: profile.annualGrowthLabel && profile.annualGrowthLabel !== "N/A" ? `${profile.annualGrowthLabel}/yr` : profile.status || "estate tracked",
        href: `/estates/${toEstateSlug(estate.id)}`
      };
    })
    .filter(Boolean);
  return neighborhoods.concat(estateItems).slice(0, 12);
}

function cleanPriceLabel(value = "") {
  return String(value).replace("/sqm est.", "/sqm").replace(" est.", "");
}

function countBy(items, getLabel) {
  const map = new Map();
  items.forEach((item) => {
    const label = getLabel(item) || "Other";
    map.set(label, (map.get(label) || 0) + 1);
  });
  return Array.from(map, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function normalizeUse(value = "") {
  if (/residential/i.test(value)) return "Mostly residential";
  if (/mixed use development/i.test(value)) return "Mixed use development";
  if (/mixed/i.test(value)) return "Mixed use";
  return value || "Other";
}

function buildConic(entries, colors) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0) || 1;
  let cursor = 0;
  const stops = entries.map((entry, index) => {
    const start = cursor;
    const end = cursor + (entry.count / total) * 100;
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatCompactPrice(value) {
  const price = Number(value) || 0;
  if (!price) return "N/A";
  if (price >= 1000000000) return `₦${Number((price / 1000000000).toFixed(1))}B`;
  if (price >= 1000000) return `₦${Math.round(price / 1000000)}M`;
  if (price >= 1000) return `₦${Math.round(price / 1000)}K`;
  return `₦${Math.round(price)}`;
}

function formatPerSqm(value) {
  const price = Number(value) || 0;
  if (price >= 1000000) return `₦${Number((price / 1000000).toFixed(1))}M`;
  if (price >= 1000) return `₦${Math.round(price / 1000)}K`;
  return `₦${Math.round(price)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

const lagosStats = [
  { label: "Population density", value: "5,000/km²" },
  { label: "Population influx", value: "~86/hour" },
  { label: "Lagos GDP", value: "$33.67B" },
  { label: "Share of Nigeria GDP", value: "25%+" },
  { label: "Urbanization rate", value: "16%" },
  { label: "Financial institutions", value: "200+" }
];

const exploreLinks = [
  { href: "/listings", title: "Land listings", text: "Available plots with size, use, price and title document." },
  { href: "/map", title: "Lagos map", text: "Neighborhoods and estates in their real locations." },
  { href: "#intelligence", title: "Market intelligence", text: "Land-use and development patterns across tracked estates." },
  { href: "/dashboard", title: "Intelligence portal", text: "The full briefing workspace for each location." }
];

const closingChecks = [
  "Price per square meter and growth signals by location",
  "Title document and estate context on every plot",
  "Planning constraints and approval history to verify"
];

const lagosReasons = [
  {
    title: "Growing population",
    text: "Lagos continues to absorb residents, workers, students, and entrepreneurs, creating durable pressure for housing, retail, logistics, and mixed-use land."
  },
  {
    title: "Economic hub",
    text: "The city concentrates ports, corporate headquarters, banks, entertainment, technology, and professional services, which keeps land close to activity valuable."
  },
  {
    title: "Fast urban growth",
    text: "New corridors, estates, road links, and commercial districts create expansion opportunities, especially where infrastructure and access are improving."
  },
  {
    title: "High appreciation potential",
    text: "Scarcity in prime locations and demand in emerging corridors can support value growth when title, access, drainage, and planning risk are properly checked."
  },
  {
    title: "Diverse options",
    text: "Clients can compare residential plots, commercial frontage, mixed-use estates, waterfront districts, and lower-entry emerging markets from one place."
  },
  {
    title: "Wealth preservation",
    text: "Land can help preserve long-term value, but Squaremeter keeps the focus on verifiable data so buyers avoid paying premium prices for weak fundamentals."
  }
];

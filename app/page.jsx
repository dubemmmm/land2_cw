import Link from "next/link";
import { ArrowRight, BarChart3, Building2, ShieldCheck } from "lucide-react";
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

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" href="/">
          <span><i /> <i /></span>
          <strong>Square Meter</strong>
        </Link>
        <nav aria-label="Public navigation">
          <a href="#overview">Overview</a>
          <a href="#intelligence">Market intelligence</a>
          <a href="#why-lagos">Why Lagos</a>
          <Link className="landing-portal-link" href="/dashboard">Intelligence portal</Link>
        </nav>
      </header>

      <section className="landing-hero" id="overview">
        <div className="landing-hero-copy">
          <span className="landing-kicker">Lagos land intelligence</span>
          <h1><span>Invest in Lagos</span><span>land with clarity.</span></h1>
          <p>
            Square Meter helps clients understand where to buy land in Lagos, what each location is worth,
            what planning risks to check, and which live plots are ready for review. It combines market
            intelligence, estate records, title context, and curated listings in one decision workspace.
          </p>
          <div className="landing-actions">
            <Link href="/listings">View land listings <ArrowRight size={16} /></Link>
            <Link href="#intelligence">Explore intelligence</Link>
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
      </section>

      <section className="landing-section landing-explainer">
        <div className="landing-section-head">
          <span>What Square Meter does</span>
          <h2>A client-facing guide for land decisions before capital is committed.</h2>
          <p>
            Land buying in Lagos is not just a price conversation. Clients need to compare locations,
            title documents, estate rules, price movement, development status, and approval risk. Square
            Meter turns those fragmented checks into a clear briefing layer before you speak to vendors,
            agents, surveyors, or lawyers.
          </p>
        </div>
        <div className="landing-explainer-grid">
          <Feature icon={BarChart3} title="Market intelligence" text="Compare price per square meter, annual growth signals, mapped estate supply, and location confidence from the Land Bible and admin updates." />
          <Feature icon={Building2} title="Curated land listings" text="Browse available plots with size, use, asking price, estate context, status, and title-document indicators before requesting deeper diligence." />
          <Feature icon={ShieldCheck} title="Risk-aware decisions" text="See planning constraints, title status, approval history, and documents to request so attractive plots can be filtered through practical risk checks." />
        </div>
      </section>

      <section className="landing-section landing-insights">
        <div className="landing-insight-grid">
          {insights.map((insight) => (
            <article key={insight.label}>
              <span>{insight.label}</span>
              <h3>{insight.title}</h3>
              <p>{insight.meta}</p>
              <b>{insight.badge}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-analytics" id="intelligence">
        <div className="landing-section-head">
          <span>Market intelligence</span>
          <h2>Analytics that show how Lagos land supply is distributed.</h2>
          <p>
            The intelligence layer tracks neighborhoods, estate development status, land-use patterns,
            price movement, and available inventory. These are directional decision tools, not a substitute
            for legal, survey, valuation, or planning verification.
          </p>
        </div>
        <div className="landing-chart-grid">
          <DonutPanel title="Land use distribution" total={estates.length} entries={landUseDistribution} />
          <DonutPanel title="Development status" total={estates.length} entries={developmentDistribution} />
        </div>
      </section>

      <section className="landing-section landing-featured-listings">
        <div className="landing-section-head inline">
          <div>
            <span>Featured land listings</span>
            <h2>Live plots ready for client review.</h2>
            <p>Start with available plots, then open the full listing page to filter by location, estate, use, price, and size.</p>
          </div>
          <Link href="/listings">See more <ArrowRight size={16} /></Link>
        </div>
        <div className="landing-listing-grid">
          {featuredListings.map((listing) => (
            <article className="landing-listing-card" key={listing.id}>
              <div className="landing-listing-media">
                {listing.photos[0] ? <img src={listing.photos[0]} alt="" /> : null}
                <span>{listing.listingStatus}</span>
                <b>{formatCompactPrice(listing.askingPrice)}</b>
              </div>
              <div>
                <h3>{listing.title}</h3>
                <p>{formatNumber(listing.sizeSqm)} sqm · {listing.landUse}</p>
                <p>{listing.neighborhoodName}{listing.estate ? ` · ${listing.estate}` : ""}</p>
                <em>{listing.titleDocument}</em>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-why" id="why-lagos">
        <div className="landing-section-head">
          <span>Why invest in Lagos</span>
          <h2>Land demand is supported by population, commerce, urban growth, and scarcity.</h2>
          <p>
            Lagos concentrates people, jobs, ports, financial services, technology, retail, and premium
            residential demand. That creates long-term land pressure, but the best opportunities still
            depend on title quality, infrastructure, access, flood risk, estate rules, and realistic resale demand.
          </p>
        </div>
        <div className="landing-lagos-stats">
          {lagosStats.map((stat) => (
            <article key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>
        <div className="landing-reason-grid">
          {lagosReasons.map((reason, index) => (
            <article key={reason.title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <h3>{reason.title}</h3>
              <p>{reason.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <div>
          <span>Ready to inspect the market?</span>
          <h2>Use Square Meter to compare Lagos land before you shortlist a plot.</h2>
        </div>
        <div>
          <Link href="/listings">Browse listings</Link>
          <Link href="/map">Open map</Link>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <article>
      <Icon size={20} />
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function DonutPanel({ title, total, entries }) {
  const colors = ["#176b54", "#d09a3d", "#2f73c4", "#e4bd82", "#7a9f8d"];
  const gradient = buildConic(entries, colors);
  return (
    <article className="landing-chart-panel">
      <h3>{title}</h3>
      <div className="landing-chart-body">
        <div className="landing-donut" style={{ background: gradient }}>
          <span><strong>{total}</strong><em>total</em></span>
        </div>
        <div className="landing-chart-legend">
          {entries.map((entry, index) => (
            <p key={entry.label}><i style={{ background: colors[index % colors.length] }} />{entry.label} <b>({entry.count})</b></p>
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
    text: "Land can help preserve long-term value, but Square Meter keeps the focus on verifiable data so buyers avoid paying premium prices for weak fundamentals."
  }
];

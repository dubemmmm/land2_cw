import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import SqmCartogram from "@/components/SqmCartogram";
import BudgetScale from "@/components/BudgetScale";
import PlotGlyph from "@/components/PlotGlyph";
import ConfidenceLegend from "@/components/ConfidenceLegend";
import { getLandBibleInventory } from "@/lib/landBible";
import { getLandListings } from "@/lib/listingStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import { confidenceLegend, confidenceLevel, confidencePattern, confidenceScore } from "@/lib/metrics";
import { formatNaira, formatSqm, layoutCartogram, realPhoto } from "@/lib/plot";
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
  const plotScale = Math.max(0, ...featuredListings.map((listing) => Number(listing.sizeSqm) || 0));
  const landUseDistribution = countBy(estates, (estate) => normalizeUse(estate.primary_use));
  const developmentDistribution = countBy(estates, (estate) => /built/i.test(estate.status || "") ? "Fully built" : "Developing");
  const priced = buildPricedLocations(marketProfiles);
  const cartogram = layoutCartogram(priced);
  const indexYear = marketProfiles[0]?.market.currentYear || new Date().getFullYear();

  return (
    <main className="landing-page">
      <SiteNav />

      <section className="land-hero sq-blueprint sq-on-navy" id="index">
        <div className="cw-container land-hero-grid">
          <div className="land-hero-copy">
            <p className="sq-anno"><b>Sheet 01</b>Lagos land price index · {indexYear}</p>
            <h1>Lagos, measured by the <em>square metre.</em></h1>
            <p className="land-hero-lede">
              Squaremeter prices, maps and grades land across Lagos, so you can see what a location is worth,
              how sure the figure is, and which plots are open for review before you commit capital.
            </p>
            <div className="land-actions">
              <Link className="cw-btn cw-btn-white" href="/listings">See plots for sale <ArrowRight size={16} /></Link>
              <Link className="cw-btn cw-btn-ghost" href="#budget">What does my budget buy?</Link>
            </div>
            <dl className="land-hero-stats">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd className="sq-fig">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {cartogram.squares.length ? (
            <div className="land-hero-drawing">
              <div className="land-hero-drawing-head">
                <p className="sq-anno"><b>Fig. 01</b>Area of each square ∝ ₦ per m²</p>
                <ConfidenceLegend onNavy />
              </div>
              <SqmCartogram layout={cartogram} />
            </div>
          ) : null}
        </div>
      </section>

      {marketTicker.length ? (
        <div className="land-ticker" aria-label="Market price highlights">
          <div>
            {marketTicker.concat(marketTicker).map((item, index) => (
              <Link href={item.href} key={`${item.href}-${item.name}-${index}`} aria-hidden={index >= marketTicker.length ? "true" : undefined} tabIndex={index >= marketTicker.length ? -1 : undefined}>
                <span>{item.name}</span>
                <strong>{item.price}</strong>
                <em>{item.growth}</em>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {priced.length ? (
        <section className="cw-section" id="budget">
          <div className="cw-container">
            <div className="land-head">
              <div>
                <p className="sq-anno"><b>Fig. 02</b>One budget, every location, one scale</p>
                <h2 className="cw-h2">What your money buys, <em>drawn to scale.</em></h2>
              </div>
              <p className="cw-lede">
                Pick a budget. Each square is the land it buys at today&rsquo;s estimated price per square metre.
                A standard Lagos plot is 648 m².
              </p>
            </div>
            <BudgetScale items={priced} />
          </div>
        </section>
      ) : null}

      <section className="cw-section" id="intelligence">
        <div className="cw-container">
          <div className="land-head">
            <div>
              <p className="sq-anno"><b>Fig. 03</b>Market read</p>
              <h2 className="cw-h2">Where the tracked market <em>stands today.</em></h2>
            </div>
            <p className="cw-lede">
              Read from {neighborhoods.length} neighbourhoods and {estates.length} estates. These are directional
              figures, not a substitute for legal, survey or valuation checks.
            </p>
          </div>
          <div className="land-signals">
            {insights.map((insight, index) => (
              <article className="sq-sheet" key={insight.label}>
                <span className="land-signal-no sq-fig">{String(index + 1).padStart(2, "0")}</span>
                <p>{insight.label}</p>
                <h3>{insight.title}</h3>
                <small>{insight.meta}</small>
                <b>{insight.badge}</b>
              </article>
            ))}
          </div>
          <div className="land-dists">
            <Distribution title="Land use across tracked estates" total={estates.length} entries={landUseDistribution} />
            <Distribution title="Development status" total={estates.length} entries={developmentDistribution} />
          </div>
        </div>
      </section>

      <section className="cw-section" id="plots">
        <div className="cw-container">
          <div className="land-head">
            <div>
              <p className="sq-anno"><b>Fig. 04</b>Plots open for review</p>
              <h2 className="cw-h2">Live plots, <em>on one scale.</em></h2>
            </div>
            <Link className="cw-btn cw-btn-outline" href="/listings">All plots <ArrowRight size={16} /></Link>
          </div>
          {featuredListings.length ? (
            <div className="land-plots">
              {featuredListings.map((listing) => {
                const photo = realPhoto(listing.photos);
                const perSqm = listing.sizeSqm ? listing.askingPrice / listing.sizeSqm : 0;
                return (
                  <Link className="sq-sheet sq-plotcard" href="/listings" key={listing.id}>
                    <div className="sq-plotcard-drawing sq-grid">
                      {photo ? <img src={photo} alt="" /> : <PlotGlyph sqm={listing.sizeSqm} scaleSqm={plotScale} />}
                      <span className={`listing-status ${statusClass(listing.listingStatus)}`}>{listing.listingStatus}</span>
                      {listing.titleDocument ? <span className="sq-stamp">{listing.titleDocument}</span> : null}
                    </div>
                    <div className="sq-plotcard-body">
                      <h3>{listing.title}</h3>
                      <p>{listing.neighborhoodName}{listing.estate ? ` · ${listing.estate}` : ""} · {listing.landUse}</p>
                      <dl>
                        <div><dt>Area</dt><dd className="sq-fig">{formatSqm(listing.sizeSqm)} m²</dd></div>
                        <div><dt>Per m²</dt><dd className="sq-fig">{formatNaira(perSqm)}</dd></div>
                        <div><dt>Asking</dt><dd className="sq-fig">{formatNaira(listing.askingPrice)}</dd></div>
                      </dl>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="sq-sheet land-empty">No plots are marked available right now. New listings appear here as soon as they are published.</p>
          )}
        </div>
      </section>

      <section className="cw-section" id="method">
        <div className="cw-container">
          <div className="land-head">
            <div>
              <p className="sq-anno"><b>Fig. 05</b>Method</p>
              <h2 className="cw-h2">Every figure says <em>how sure it is.</em></h2>
            </div>
            <p className="cw-lede">
              Land buying in Lagos is not only a price conversation. Squaremeter joins price, title, estate rules
              and planning risk in one place, and grades each location by how well its data is sourced.
            </p>
          </div>
          <div className="land-method">
            <ol className="land-spec">
              {features.map((feature, index) => (
                <li key={feature.title}>
                  <span className="sq-fig">{String.fromCharCode(65 + index)}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </li>
              ))}
            </ol>
            <aside className="sq-sheet land-key" aria-label="How data confidence is drawn">
              <p className="sq-anno">Key · data confidence</p>
              <ul>
                {confidenceLegend.map((item) => (
                  <li key={item.pattern}>
                    <i className={`sq-pat sq-pat-${item.pattern}`} aria-hidden="true" />
                    <strong>{item.level}</strong>
                    <span className="sq-fig">{item.range}</span>
                    <p>{item.meaning}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section className="cw-section" id="why-lagos">
        <div className="cw-container">
          <div className="land-head">
            <div>
              <p className="sq-anno"><b>Fig. 06</b>Why Lagos</p>
              <h2 className="cw-h2">Demand is held up by people, commerce <em>and scarcity.</em></h2>
            </div>
            <p className="cw-lede">
              Lagos concentrates people, jobs, ports and capital. That creates long-term pressure on land, but the
              best plots still depend on title quality, access, flood risk and realistic resale demand.
            </p>
          </div>
          <dl className="land-lagos-stats">
            {lagosStats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd className="sq-fig">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <ol className="land-reasons">
            {lagosReasons.map((reason, index) => (
              <li key={reason.title}>
                <span className="sq-fig">{String(index + 1).padStart(2, "0")}</span>
                <h3>{reason.title}</h3>
                <p>{reason.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cw-section cw-section-last">
        <div className="cw-container">
          <div className="land-close sq-blueprint sq-on-navy">
            <div className="land-close-copy">
              <p className="sq-anno"><b>Next</b>Start with a plot, then check the ground around it</p>
              <h2>Shortlist land with the <em>measurements in hand.</em></h2>
              <div className="land-actions">
                <Link className="cw-btn cw-btn-white" href="/listings">Browse plots <ArrowRight size={16} /></Link>
                <Link className="cw-btn cw-btn-ghost" href="/map">Open the map</Link>
              </div>
            </div>
            <nav className="land-close-index" aria-label="Explore Squaremeter">
              {exploreLinks.map((item, index) => (
                <Link href={item.href} key={item.href}>
                  <span className="sq-fig">{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{item.title}</strong><small>{item.text}</small></span>
                  <ArrowUpRight size={18} />
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

const distPatterns = ["solid", "hatch", "dot", "none"];

// Share of a whole, drawn as one bar to scale. Segments are told apart by pattern.
function Distribution({ title, total, entries }) {
  const sum = entries.reduce((acc, entry) => acc + entry.count, 0) || 1;
  return (
    <article className="land-dist">
      <header>
        <h3>{title}</h3>
        <span className="sq-fig">{total} estates</span>
      </header>
      <div className="land-dist-bar" role="img" aria-label={entries.map((entry) => `${entry.label} ${entry.count}`).join(", ")}>
        {entries.map((entry, index) => (
          <i key={entry.label} className={`sq-pat-${distPatterns[index % distPatterns.length]}`} style={{ flexGrow: entry.count }} />
        ))}
      </div>
      <ul>
        {entries.map((entry, index) => (
          <li key={entry.label}>
            <i className={`sq-pat sq-pat-${distPatterns[index % distPatterns.length]}`} aria-hidden="true" />
            <span>{entry.label}</span>
            <b className="sq-fig">{entry.count}</b>
            <em className="sq-fig">{Math.round((entry.count / sum) * 100)}%</em>
          </li>
        ))}
      </ul>
    </article>
  );
}

function buildPricedLocations(marketProfiles) {
  return marketProfiles
    .filter((item) => Number(item.market.priceValue) > 0 && item.market.trendCurrency !== "USD")
    .map(({ neighborhood, market }) => {
      const score = confidenceScore(neighborhood);
      const center = neighborhood.geometry?.center || [];
      return {
        id: neighborhood.id,
        name: neighborhood.name,
        href: `/locations/${neighborhood.id}`,
        priceValue: market.priceValue,
        priceLabel: cleanPriceLabel(market.priceLabel),
        priceShort: formatNaira(market.priceValue),
        growthLabel: market.annualGrowthLabel && market.annualGrowthLabel !== "N/A" ? market.annualGrowthLabel : "—",
        confidence: score,
        confidenceLevel: confidenceLevel(score),
        pattern: confidencePattern(score),
        lat: Number(center[0]),
        lng: Number(center[1])
      };
    });
}

function statusClass(status = "") {
  return String(status).toLowerCase().replace(/\s+/g, "-");
}

function buildHeroStats(neighborhoods, estates, marketProfiles) {
  const avgPrice = average(marketProfiles.map((item) => item.market.priceValue).filter(Boolean));
  const totalLand = estates.reduce((sum, estate) => sum + (Number(estate.total_land_sqm) || 0), 0);
  return [
    { label: "Neighborhoods", value: neighborhoods.length },
    { label: "Estates tracked", value: estates.length },
    { label: "Avg price / m²", value: avgPrice ? formatNaira(avgPrice) : "Under review" },
    { label: "m² mapped", value: totalLand ? `${Math.round(totalLand / 1000000)}M` : "Updating" }
  ];
}

function buildInsightCards(marketProfiles, estates) {
  const sortedGrowth = [...marketProfiles].sort((a, b) => (b.market.annualGrowth || 0) - (a.market.annualGrowth || 0));
  // Dollar-priced markets are left out: they cannot be ranked against naira prices.
  const sortedPrice = [...marketProfiles].filter((item) => item.market.priceValue && item.market.trendCurrency !== "USD").sort((a, b) => a.market.priceValue - b.market.priceValue);
  const premium = [...sortedPrice].reverse()[0];
  const developing = estates.filter((estate) => /develop/i.test(estate.status || "")).length;
  return [
    {
      label: "Top appreciating area",
      title: sortedGrowth[0]?.neighborhood.name || "Banana Island",
      meta: cleanPriceLabel(sortedGrowth[0]?.market.priceLabel) || "Tracked market",
      badge: `${sortedGrowth[0]?.market.annualGrowthLabel || "~15%"} est. annual growth`
    },
    {
      label: "Best entry point",
      title: sortedPrice[0]?.neighborhood.name || "Ajah",
      meta: cleanPriceLabel(sortedPrice[0]?.market.priceLabel) || "Entry pricing under review",
      badge: "Lowest tracked naira price"
    },
    {
      label: "Premium market",
      title: premium?.neighborhood.name || "Ikoyi",
      meta: cleanPriceLabel(premium?.market.priceLabel) || "Premium pricing under review",
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
  return String(value || "").replace("/sqm est.", "/m² est.").replace("/sqm", "/m²");
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

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
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
  { href: "#intelligence", title: "Market read", text: "Land-use and development patterns across tracked estates." },
  { href: "/dashboard", title: "Intelligence portal", text: "The full briefing workspace for each location." }
];

const features = [
  { title: "Price by the square metre", text: "Compare price per m², annual growth and mapped estate supply across locations, from the Land Bible and admin updates." },
  { title: "Plots with their papers", text: "Browse available plots with size, use, asking price, estate and the title document recorded for each listing." },
  { title: "Risk before commitment", text: "See planning constraints, approval history and the documents to request, so an attractive plot is checked against practical risk." }
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

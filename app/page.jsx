import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import SqmCartogram from "@/components/SqmCartogram";
import BudgetScale from "@/components/BudgetScale";
import PlotCard from "@/components/PlotCard";
import ConfidenceLegend from "@/components/ConfidenceLegend";
import { getLandBibleInventory } from "@/lib/landBible";
import { getLandListings } from "@/lib/listingStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import { confidenceLegend, confidenceLevel, confidencePattern, confidenceScore } from "@/lib/metrics";
import { areaPhoto, photo, photoCredits } from "@/lib/photos";
import { formatNaira, layoutCartogram } from "@/lib/plot";
import { getLandMarketProfile } from "@/lib/landBible";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [neighborhoods, listings] = await Promise.all([getNeighborhoods(), getLandListings()]);
  const inventory = getLandBibleInventory();
  const estates = inventory.estates || [];
  const marketProfiles = neighborhoods
    .map((neighborhood) => ({ neighborhood, market: getLandMarketProfile(neighborhood.id) }))
    .filter((item) => item.market);
  const featuredListings = listings
    .filter((listing) => listing.listingStatus === "Available")
    .slice(0, 3);
  const plotScale = Math.max(0, ...featuredListings.map((listing) => Number(listing.sizeSqm) || 0));
  const landUseDistribution = countBy(estates, (estate) => normalizeUse(estate.primary_use));
  const developmentDistribution = countBy(estates, (estate) => /built/i.test(estate.status || "") ? "Fully built" : "Developing");
  const priced = buildPricedLocations(marketProfiles);
  const cartogram = layoutCartogram(priced);
  const heroPhoto = photo("ikoyi", 1920);
  const lagosPhotos = [photo("victoriaIsland"), photo("bridgeNight")];
  const methodPhoto = photo("skyline", 1920);
  const closePhoto = photo("farmland", 1920);
  const locationRows = marketProfiles
    .filter((item) => item.market.priceValue)
    .map(({ neighborhood, market }) => {
      const score = confidenceScore(neighborhood);
      return {
        id: neighborhood.id,
        name: neighborhood.name,
        area: neighborhood.jurisdiction || market.lga || "Lagos",
        href: `/locations/${neighborhood.id}`,
        photo: areaPhoto(neighborhood.id)?.src || null,
        price: cleanPriceLabel(market.priceLabel).replace("/m² est.", "").replace("/m²", ""),
        growth: market.annualGrowthLabel && market.annualGrowthLabel !== "N/A" ? market.annualGrowthLabel : "—",
        estates: market.estateSummary?.total ?? "—",
        score,
        level: confidenceLevel(score),
        pattern: confidencePattern(score)
      };
    });
  const indexYear = marketProfiles[0]?.market.currentYear || new Date().getFullYear();

  const avgPrice = average(priced.map((item) => item.priceValue));
  const priciest = priced.reduce((best, item) => (!best || item.priceValue > best.priceValue ? item : best), null);
  const cheapest = priced.reduce((best, item) => (!best || item.priceValue < best.priceValue ? item : best), null);
  const developing = estates.filter((estate) => /develop/i.test(estate.status || "")).length;

  return (
    <main className="landing-page">
      <SiteNav />

      <section className="land-hero">
        <img className="land-hero-photo" src={heroPhoto.src} alt="" />
        <div className="cw-container land-hero-grid">
          <div className="land-hero-copy">
            <h1>Know what Lagos land is worth before you buy it.</h1>
            <p>
              Squaremeter tracks the price of a square metre across {neighborhoods.length} neighbourhoods
              and {estates.length} estates, tells you how reliable each figure is, and lists plots that are
              open for review.
            </p>
            <div className="land-actions">
              <Link className="cw-btn cw-btn-white" href="/listings">See plots for sale <ArrowRight size={16} /></Link>
              <Link className="cw-btn cw-btn-ghost" href="#budget">Try the budget tool</Link>
            </div>
          </div>
          {cartogram.squares.length ? (
            <div className="land-hero-drawing">
              <div className="land-hero-drawing-head">
                <p>Price per m², {indexYear}. Bigger square, higher price.</p>
                <ConfidenceLegend onNavy />
              </div>
              <SqmCartogram layout={cartogram} />
            </div>
          ) : null}
        </div>
      </section>

      {priced.length ? (
        <section className="cw-section" id="budget">
          <div className="cw-container">
            <h2 className="cw-h2">How much land does your budget buy?</h2>
            <p className="land-sub">
              Pick an amount. Each square is the land it buys in that location at today&rsquo;s estimated price,
              drawn at one scale next to a standard 648 m² Lagos plot.
            </p>
            <BudgetScale items={priced} />
          </div>
        </section>
      ) : null}

      <section className="cw-section" id="prices">
        <div className="cw-container">
          {priciest && cheapest ? (
            <p className="land-statement">
              Across the locations we track, land averages <b>{formatNaira(avgPrice)} per m²</b>.{" "}
              <Link href={priciest.href}>{priciest.name}</Link> is the most expensive at {priciest.priceShort}, and{" "}
              <Link href={cheapest.href}>{cheapest.name}</Link> is the lowest at {cheapest.priceShort}.{" "}
              {developing} of {estates.length} estates are still being built out.
            </p>
          ) : null}
          <div className="land-table-wrap">
            <table className="land-table">
              <thead>
                <tr>
                  <th scope="col">Location</th>
                  <th scope="col">Price per m²</th>
                  <th scope="col">Growth per year</th>
                  <th scope="col">Estates tracked</th>
                  <th scope="col">Data confidence</th>
                  <th scope="col"><span className="land-visually-hidden">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {locationRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <Link href={row.href}>
                        {row.photo ? <img src={row.photo} alt="" loading="lazy" /> : <span className="land-table-blank" />}
                        <span><strong>{row.name}</strong><small>{row.area}</small></span>
                      </Link>
                    </th>
                    <td className="sq-fig">{row.price}</td>
                    <td className="sq-fig">{row.growth}</td>
                    <td className="sq-fig">{row.estates}</td>
                    <td>
                      <span className="land-conf"><i className={`sq-pat sq-pat-${row.pattern}`} aria-hidden="true" />{row.level}{row.score ? ` · ${row.score}` : ""}</span>
                    </td>
                    <td><Link className="land-table-go" href={row.href} aria-label={`Open ${row.name}`}><ArrowRight size={16} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="land-dists">
            <Distribution title="What the tracked estates are used for" total={estates.length} entries={landUseDistribution} />
            <Distribution title="How far along they are" total={estates.length} entries={developmentDistribution} />
          </div>
        </div>
      </section>

      <section className="cw-section" id="plots">
        <div className="cw-container">
          <div className="land-row-head">
            <h2 className="cw-h2">Plots open for review</h2>
            <Link className="cw-link" href="/listings">See all plots <ArrowRight size={15} /></Link>
          </div>
          {featuredListings.length ? (
            <div className="land-plots">
              {featuredListings.map((listing) => (
                <PlotCard listing={listing} scaleSqm={plotScale} href="/listings" key={listing.id} />
              ))}
            </div>
          ) : (
            <p className="sq-sheet land-empty">No plots are marked available right now. New listings appear here as soon as they are published.</p>
          )}
        </div>
      </section>

      <section className="cw-section" id="method">
        <div className="cw-container land-method">
          <img className="land-method-photo" src={methodPhoto.src} alt={methodPhoto.place} loading="lazy" />
          <div>
            <h2 className="cw-h2">We tell you how sure each figure is</h2>
            <p className="land-sub">
              A price is only as good as its sources. Every location carries a confidence score from 0 to 100,
              and you will see it drawn the same way wherever a price appears.
            </p>
            <ul className="land-key">
              {confidenceLegend.map((item) => (
                <li key={item.pattern}>
                  <i className={`sq-pat sq-pat-${item.pattern}`} aria-hidden="true" />
                  <strong>{item.level}</strong>
                  <span>{item.meaning}</span>
                  <em className="sq-fig">{item.range}</em>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="cw-container land-features">
          {features.map((feature) => (
            <div key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="why-lagos">
        <div className="cw-container land-lagos">
          <div className="land-lagos-copy">
            <h2 className="cw-h2">Why Lagos land holds its value</h2>
            <p>
              Lagos is home to about 5,000 people per square kilometre and takes in roughly 86 new residents every
              hour. It produces more than a quarter of Nigeria&rsquo;s GDP and hosts over 200 financial
              institutions, so demand for land near work, ports and transport stays high while supply in prime
              areas is fixed.
            </p>
            <p>
              That pressure does not make every plot a good one. Title quality, road access, drainage, flood risk
              and estate rules still decide whether land keeps its value, which is why Squaremeter shows those
              checks next to the price.
            </p>
            <Link className="cw-link" href="/map">Explore the map <ArrowRight size={15} /></Link>
          </div>
          <div className="land-lagos-photos">
            {lagosPhotos.slice(0, 2).map((item) => (
              <figure key={item.place}>
                <img src={item.src} alt={item.place} loading="lazy" />
                <figcaption>{item.place}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="land-close">
        <img className="land-close-photo" src={closePhoto.src} alt="" loading="lazy" />
        <div className="cw-container">
          <h2>Start with a plot, then check the ground around it.</h2>
          <div className="land-actions">
            <Link className="cw-btn cw-btn-white" href="/listings">Browse plots <ArrowRight size={16} /></Link>
            <Link className="cw-btn cw-btn-ghost" href="/map">Open the map</Link>
          </div>
        </div>
      </section>

      <SiteFooter note={`Stand-in photos from Wikimedia Commons. ${photoCredits}`} />
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
        photo: areaPhoto(neighborhood.id, neighborhood.id === "banana-island" ? 1920 : 960)?.src || null,
        lat: Number(center[0]),
        lng: Number(center[1])
      };
    });
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

const features = [
  { title: "Price by the square metre", text: "Compare price per m², annual growth and mapped estate supply across locations, from the Land Bible and admin updates." },
  { title: "Plots with their papers", text: "Browse available plots with size, use, asking price, estate and the title document recorded for each listing." },
  { title: "Risk before commitment", text: "See planning constraints, approval history and the documents to request, so an attractive plot is checked against practical risk." }
];


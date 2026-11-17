import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, MessageCircle, Pencil, Phone } from "lucide-react";
import AppShell from "@/components/AppShell";
import PlotCard from "@/components/PlotCard";
import { getAdminSession } from "@/lib/auth";
import { againstMedian, againstMedianText } from "@/lib/listingMath";
import { getAreaStats } from "@/lib/listingStats";
import { getLandListing, getLandListings } from "@/lib/listingStore";
import { formatDate } from "@/lib/metrics";
import { areaPhoto, photo, photoCredits } from "@/lib/photos";
import { formatNaira, formatSqm, headlinePrice, quotedPrice, realPhoto } from "@/lib/plot";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const listing = await getLandListing(id);
  return listing ? { title: `${listing.title} — Squaremeter by CW` } : {};
}

export default async function ListingPage({ params }) {
  const { id } = await params;
  const admin = await getAdminSession();
  const listing = await getLandListing(id, { includeDrafts: Boolean(admin) });
  if (!listing) notFound();

  const area = await getAreaStats(listing.neighborhoodId);
  const others = (await getLandListings({ summary: true }))
    .filter((item) => item.neighborhoodId === listing.neighborhoodId && item.id !== listing.id)
    .slice(0, 4);
  const own = realPhoto(listing.photos);
  const view = own ? null : areaPhoto(listing.neighborhoodId, 1920) || photo("skyline", 1920);
  const price = headlinePrice(listing);
  const digits = listing.agentPhone.replace(/\D/g, "");
  const facts = [
    { label: "Plot size", value: listing.sizeSqm ? `${formatSqm(listing.sizeSqm)} m²` : "Not given as a single plot size" },
    { label: "Land use", value: listing.landUse || "Not stated in the listing" },
    { label: "Offer", value: listing.offerType },
    { label: "Title document", value: listing.titleDocument || "Not stated in the listing" },
    listing.estate ? { label: "Estate or district", value: listing.estate } : null,
    listing.address ? { label: "Address", value: listing.address } : null,
    listing.listingStatus !== "Available" ? { label: "Status", value: listing.listingStatus } : null,
    { label: "Listed", value: formatDate(listing.listedAt) },
    listing.sourceId ? { label: "Reference", value: listing.sourceId } : null
  ].filter(Boolean);

  return (
    <AppShell active="listings">
      <div className="focus-page">
        <header className="cw-pagehead focus-head">
          <div className="focus-head-main">
            <nav className="cw-crumbs" aria-label="Breadcrumb">
              <Link href="/listings">Listings</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/listings?location=${listing.neighborhoodId}`}>{listing.neighborhoodName}</Link>
            </nav>
            <h1 className="cw-pagehead-title">{listing.title}</h1>
            <p className="cw-lede">{[listing.neighborhoodName, listing.estate, listing.landUse].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="focus-head-actions">
            {admin ? (
              <Link className="cw-btn cw-btn-soft cw-btn-sm" href={`/listings/new?id=${listing.id}`}><Pencil size={15} /> Edit</Link>
            ) : null}
            {listing.sourceUrl ? (
              <a className="cw-btn cw-btn-navy cw-btn-sm" href={listing.sourceUrl} target="_blank" rel="noreferrer">
                View on cwlagos.com <ExternalLink size={15} />
              </a>
            ) : null}
          </div>
        </header>

        <figure className="focus-photo">
          <img src={own || view.src} alt={own ? listing.title : `Aerial view of ${view.place}`} />
          {view ? <figcaption>Area view · {view.place}, not this plot</figcaption> : null}
        </figure>

        <p className="focus-statement">
          <PriceSentence listing={listing} price={price} />{" "}
          <AreaSentence listing={listing} area={area} />
        </p>
        {listing.converted ? (
          <p className="focus-note listing-detail-note">
            The seller lists this at {quotedPrice(listing)}. Naira figures use ₦{new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(listing.fxRate)} to
            the dollar{listing.fxAsOf ? `, the published rate of ${formatDate(listing.fxAsOf)}` : ""}, and move with the exchange rate. <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by Exchange Rate API</a>.
          </p>
        ) : null}

        <div className="focus-split listing-detail-split">
          <section>
            <div className="focus-section-head"><h2 className="cw-h3">Plot facts</h2></div>
            <dl className="focus-facts">
              {facts.map((fact) => (
                <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
              ))}
            </dl>
          </section>
          {listing.agentName || listing.agentPhone ? (
            <section>
              <div className="focus-section-head"><h2 className="cw-h3">Contact the agent</h2></div>
              <p className="listing-agent-name">{listing.agentName || "CW Real Estate"}<span>CW Real Estate</span></p>
              {listing.agentPhone ? (
                <div className="listing-agent-actions">
                  <a className="cw-btn cw-btn-navy" href={`tel:+${digits}`}><Phone size={16} /> {listing.agentPhone}</a>
                  <a className="cw-btn cw-btn-soft" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
                </div>
              ) : null}
              {listing.sourceId ? <p className="focus-note listing-agent-ref">Quote reference {listing.sourceId} when you call.</p> : null}
            </section>
          ) : null}
        </div>

        {listing.description ? (
          <section className="focus-section">
            <div className="focus-section-head"><h2 className="cw-h3">From the listing</h2></div>
            <div className="listing-description">{listing.description}</div>
          </section>
        ) : null}

        {others.length ? (
          <section className="focus-section">
            <div className="focus-section-head">
              <h2 className="cw-h3">Other plots in {listing.neighborhoodName}</h2>
              <Link className="cw-link" href={`/listings?location=${listing.neighborhoodId}`}>See all <ArrowRight size={14} /></Link>
            </div>
            <div className="focus-plots">
              {others.map((item) => (
                <PlotCard listing={item} note={againstMedianText(item, area?.median, item.neighborhoodName)} key={item.id} />
              ))}
            </div>
          </section>
        ) : null}

        <p className="sq-photo-credit">Area views are stand-in photos from Wikimedia Commons, not the listed plots. {photoCredits}</p>
      </div>
    </AppShell>
  );
}

function PriceSentence({ listing, price }) {
  const size = listing.sizeSqm ? <>{formatSqm(listing.sizeSqm)} m² </> : null;
  const place = <>in {listing.neighborhoodName}</>;
  if (!price.value) return <>This {size}plot {place} has no price on the listing.</>;
  if (listing.offerType === "Lease") {
    return <>This {size}plot {place} is offered on lease at <b className="sq-fig">{price.value}</b>.</>;
  }
  if (listing.priceBasis === "unknown") {
    return <>This {size}plot {place} is quoted at <b className="sq-fig">{price.value}</b>, without saying whether that is for the whole plot or per m².</>;
  }
  const venture = listing.offerType === "Joint venture";
  return (
    <>
      This {size}plot {place} is {venture ? "offered as a joint venture, valued at" : "offered at"} <b className="sq-fig">{price.value}</b>
      {listing.askingPrice && listing.pricePerSqm ? <>, or <b className="sq-fig">{formatNaira(listing.pricePerSqm)} per m²</b></> : null}.
    </>
  );
}

function AreaSentence({ listing, area }) {
  if (!area?.median) {
    return area?.count
      ? <>There are too few priced listings in {listing.neighborhoodName} to give a median asking price.</>
      : null;
  }
  const basis = <>the median asking price of {formatNaira(area.median)} per m² across {area.pricedCount} {listing.neighborhoodName} listings</>;
  const diff = againstMedian(listing, area.median);
  if (diff === null) {
    return <>For comparison, the median asking price across {area.pricedCount} {listing.neighborhoodName} listings for sale is {formatNaira(area.median)} per m².</>;
  }
  if (Math.abs(diff) < 3) return <>That is in line with {basis}.</>;
  return <>That is {Math.abs(diff)}% {diff > 0 ? "above" : "below"} {basis}.</>;
}

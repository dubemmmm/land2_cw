"use client";

import Link from "next/link";
import { Grid2X2, List, Plus, RotateCcw } from "lucide-react";
import PlotCard from "@/components/PlotCard";
import { againstMedianText, medianRate, quantile } from "@/lib/listingMath";
import { photoCredits } from "@/lib/photos";
import { formatNaira, formatSqm, headlinePrice, quotedPrice, realPhoto } from "@/lib/plot";
import { useEffect, useMemo, useState } from "react";

const landUses = ["Residential", "Commercial", "Mixed-use", "Industrial"];
const offerTypes = ["Sale", "Joint venture", "Lease"];
const PAGE_SIZE = 24;

// areaMedians: { [neighborhoodId]: median asking ₦ per m² } for areas with enough listings.
export default function ListingsClient({ initialListings, neighborhoods, estates, areaMedians = {}, fx = null, initialView = "cards", initialLocation = "all", isAdmin = false }) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [landUse, setLandUse] = useState("all");
  const [estate, setEstate] = useState("all");
  const [location, setLocation] = useState(initialLocation || "all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [offer, setOffer] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  const locationOptions = useMemo(() => {
    const used = new Set(initialListings.map((listing) => listing.neighborhoodId));
    return neighborhoods.filter((neighborhood) => used.has(neighborhood.id));
  }, [initialListings, neighborhoods]);

  const estateOptions = useMemo(() => {
    const names = new Set(initialListings.map((listing) => listing.estate).filter(Boolean));
    estates.forEach((item) => {
      if (initialListings.some((listing) => listing.neighborhoodId === item.neighborhoodId)) names.add(item.name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [estates, initialListings]);

  const visibleListings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const minPriceValue = Number(minPrice) * 1000000 || 0;
    const maxPriceValue = Number(maxPrice) * 1000000 || Infinity;
    const minSizeValue = Number(minSize) || 0;
    const maxSizeValue = Number(maxSize) || Infinity;
    return [...initialListings]
      .filter((listing) => isAdmin || listing.workflowStatus === "Published")
      .filter((listing) => location === "all" || listing.neighborhoodId === location)
      .filter((listing) => landUse === "all" || listing.landUse === landUse)
      .filter((listing) => offer === "all" || listing.offerType === offer)
      .filter((listing) => estate === "all" || listing.estate === estate)
      // A plot with no total price or no size only drops out once that range is actually set.
      .filter((listing) => (!minPrice && !maxPrice) || (listing.askingPrice > 0 && listing.askingPrice >= minPriceValue && listing.askingPrice <= maxPriceValue))
      .filter((listing) => (!minSize && !maxSize) || (listing.sizeSqm > 0 && listing.sizeSqm >= minSizeValue && listing.sizeSqm <= maxSizeValue))
      .filter((listing) => {
        if (!needle) return true;
        return [listing.title, listing.neighborhoodName, listing.estate, listing.landUse, listing.titleDocument, listing.listingStatus]
          .some((value) => String(value || "").toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        // Plots without the figure being sorted on go last.
        if (sortBy === "price-high") return b.askingPrice - a.askingPrice;
        if (sortBy === "price-low") return (a.askingPrice || Infinity) - (b.askingPrice || Infinity);
        if (sortBy === "rate-low") return (a.pricePerSqm || Infinity) - (b.pricePerSqm || Infinity);
        if (sortBy === "size-high") return b.sizeSqm - a.sizeSqm;
        return String(b.listedAt).localeCompare(String(a.listedAt));
      });
  }, [estate, initialListings, isAdmin, landUse, location, maxPrice, maxSize, minPrice, minSize, offer, query, sortBy]);

  const stats = useMemo(() => buildStats(visibleListings), [visibleListings]);
  const pageListings = visibleListings.slice(0, shown);
  const heading = location === "all" ? "All areas" : neighborhoods.find((item) => item.id === location)?.name || "Listings";
  const hasConverted = visibleListings.some((listing) => listing.converted);

  // A change of filter or sort starts again from the first page.
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [estate, landUse, location, maxPrice, maxSize, minPrice, minSize, offer, query, sortBy]);

  function switchView(next) {
    setView(next);
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    window.history.replaceState(null, "", `/listings?${params.toString()}`);
  }

  function selectLocation(next) {
    setLocation(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "all") params.delete("location");
    else params.set("location", next);
    if (view !== "cards") params.set("view", view);
    const queryString = params.toString();
    window.history.replaceState(null, "", queryString ? `/listings?${queryString}` : "/listings");
  }

  function resetFilters() {
    setQuery("");
    setLandUse("all");
    setEstate("all");
    setMinPrice("");
    setMaxPrice("");
    setMinSize("");
    setMaxSize("");
    setSortBy("newest");
    setOffer("all");
    selectLocation("all");
  }

  return (
    <section className="listings-page">
      <header className="cw-pagehead listings-header">
        <div>
          <nav className="cw-crumbs" aria-label="Breadcrumb">
            <Link href="/">Squaremeter</Link>
            <span aria-hidden="true">/</span>
            <span>Listings</span>
          </nav>
          <h1 className="cw-pagehead-title">Land listings</h1>
          <ListingSummary stats={stats} total={initialListings.length} />
        </div>
        <div className="listing-header-actions">
          <div className="cw-tabs listing-view-toggle" role="group" aria-label="Listing view">
            <button className={view === "cards" ? "active" : ""} type="button" onClick={() => switchView("cards")} aria-label="Card view" aria-pressed={view === "cards"}>
              <Grid2X2 size={15} aria-hidden="true" /> Cards
            </button>
            <button className={view === "ledger" ? "active" : ""} type="button" onClick={() => switchView("ledger")} aria-label="Table view" aria-pressed={view === "ledger"}>
              <List size={15} aria-hidden="true" /> Table
            </button>
          </div>
          <Link className="cw-btn cw-btn-navy cw-btn-sm" href={isAdmin ? "/listings/new" : "/admin/login?next=%2Flistings%2Fnew"}>
            <Plus size={16} aria-hidden="true" /> New listing
          </Link>
        </div>
      </header>

      <section className="listing-filters" aria-label="Listing filters">
        <div className="listing-filter-fields">
          <label className="cw-field listing-filter-search">
            <span>Search</span>
            <input className="cw-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, area, estate or document" />
          </label>
          <label className="cw-field listing-filter-estate">
            <span>Estate</span>
            <select className="cw-select" value={estate} onChange={(event) => setEstate(event.target.value)} aria-label="Estate filter">
              <option value="all">All estates</option>
              {estateOptions.map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>
          <div className="cw-field listing-filter-range" role="group" aria-label="Price range in millions of naira">
            <span>Price, ₦ million</span>
            <div>
              <input className="cw-input" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} inputMode="numeric" placeholder="Min" aria-label="Minimum price in millions of naira" />
              <input className="cw-input" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputMode="numeric" placeholder="Max" aria-label="Maximum price in millions of naira" />
            </div>
          </div>
          <div className="cw-field listing-filter-range" role="group" aria-label="Plot size range in square metres">
            <span>Size, m²</span>
            <div>
              <input className="cw-input" value={minSize} onChange={(event) => setMinSize(event.target.value)} inputMode="numeric" placeholder="Min" aria-label="Minimum size in square metres" />
              <input className="cw-input" value={maxSize} onChange={(event) => setMaxSize(event.target.value)} inputMode="numeric" placeholder="Max" aria-label="Maximum size in square metres" />
            </div>
          </div>
          <label className="cw-field listing-filter-sort">
            <span>Sort by</span>
            <select className="cw-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort listings">
              <option value="newest">Newest first</option>
              <option value="price-high">Price, high to low</option>
              <option value="price-low">Price, low to high</option>
              <option value="rate-low">Price per m², low to high</option>
              <option value="size-high">Size, largest first</option>
            </select>
          </label>
          <button className="cw-btn cw-btn-soft listing-reset-btn" type="button" onClick={resetFilters}>
            <RotateCcw size={15} aria-hidden="true" /> Reset
          </button>
        </div>

        <div className="listing-toggle-row">
          <span id="listing-use-label">Land use</span>
          <div className="listing-toggles" role="group" aria-labelledby="listing-use-label">
            <button type="button" aria-pressed={landUse === "all"} onClick={() => setLandUse("all")}>All uses</button>
            {landUses.map((use) => (
              <button type="button" aria-pressed={landUse === use} onClick={() => setLandUse(use)} key={use}>{use}</button>
            ))}
          </div>
        </div>
        <div className="listing-toggle-row">
          <span id="listing-offer-label">Offer</span>
          <div className="listing-toggles" role="group" aria-labelledby="listing-offer-label">
            <button type="button" aria-pressed={offer === "all"} onClick={() => setOffer("all")}>All offers</button>
            {offerTypes.map((type) => (
              <button type="button" aria-pressed={offer === type} onClick={() => setOffer(type)} key={type}>{type}</button>
            ))}
          </div>
        </div>
        <div className="listing-toggle-row">
          <span id="listing-area-label">Area</span>
          <div className="listing-toggles" role="group" aria-labelledby="listing-area-label">
            <button type="button" aria-pressed={location === "all"} onClick={() => selectLocation("all")}>All areas</button>
            {locationOptions.map((neighborhood) => (
              <button type="button" aria-pressed={location === neighborhood.id} onClick={() => selectLocation(neighborhood.id)} key={neighborhood.id}>
                {neighborhood.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!visibleListings.length ? (
        <div className="listing-empty">
          <strong>No listings match these filters</strong>
          <p>Widen the price or size range, or reset the filters to see every plot.</p>
        </div>
      ) : (
        <>
          {view === "cards"
            ? <ListingCards heading={heading} total={visibleListings.length} listings={pageListings} areaMedians={areaMedians} isAdmin={isAdmin} />
            : <ListingLedger heading={heading} total={visibleListings.length} listings={pageListings} areaMedians={areaMedians} isAdmin={isAdmin} />}
          {shown < visibleListings.length ? (
            <div className="listing-more">
              <button className="cw-btn cw-btn-soft" type="button" onClick={() => setShown((count) => count + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, visibleListings.length - shown)} more
              </button>
              <span>Showing {shown} of {visibleListings.length}</span>
            </div>
          ) : null}
          <p className="listing-footnote">
            Prices are what sellers are asking, not sale prices. Medians leave out joint ventures, leases and plots with no price per m².
            {hasConverted && fx ? <> Prices listed in US dollars are converted at ₦{new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(fx.rate)} to the dollar{fx.asOf ? ` (rate of ${fx.asOf})` : ""}, with <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">rates by Exchange Rate API</a>.</> : null}
          </p>
          {view === "cards" ? (
            <p className="sq-photo-credit">Area views are stand-in photos from Wikimedia Commons, not the listed plots. {photoCredits}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

// One sentence carrying the figures for whatever the filters currently show.
function ListingSummary({ stats, total }) {
  if (!stats.count) {
    return <p className="cw-lede listings-summary">None of the {total} {total === 1 ? "plot" : "plots"} on record match these filters.</p>;
  }
  const plots = stats.count === 1 ? "plot" : "plots";
  return (
    <p className="cw-lede listings-summary">
      {stats.count === total
        ? <><strong>{stats.count}</strong> {plots}</>
        : <><strong>{stats.count}</strong> of {total} plots shown</>}
      {stats.median ? <>, median asking price <strong>{formatNaira(stats.median)} per m²</strong></> : null}
      {stats.typicalSize ? <>, typical plot <strong>{formatSqm(stats.typicalSize)} m²</strong></> : null}
      .
    </p>
  );
}

function compareNote(listing, areaMedians) {
  return againstMedianText(listing, areaMedians[listing.neighborhoodId], listing.neighborhoodName);
}

function ListingCards({ heading, total, listings, areaMedians, isAdmin }) {
  return (
    <div className="listing-card-groups">
      <section className="listing-group" data-span="4">
        <h2>{heading} <span>{total} {total === 1 ? "listing" : "listings"}</span></h2>
        <div className="listing-card-grid">
          {listings.map((listing) => (
            <PlotCard
              listing={listing}
              note={[compareNote(listing, areaMedians), listing.converted ? `Listed at ${quotedPrice(listing)}` : ""].filter(Boolean).join(" · ")}
              badge={isAdmin && listing.workflowStatus === "Draft" ? <span className="listing-draft-badge">Draft</span> : null}
              key={listing.id}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ListingLedger({ heading, total, listings, areaMedians, isAdmin }) {
  return (
    <div className="listing-ledger">
      <table className="listing-ledger-table">
        <thead>
          <tr>
            <th scope="col">Listing</th>
            <th scope="col">Area</th>
            <th scope="col">Use</th>
            <th scope="col" className="listing-num">Size</th>
            <th scope="col" className="listing-num">Asking price</th>
            <th scope="col" className="listing-num">Per m²</th>
            <th scope="col">Against area median</th>
            <th scope="col">Title document</th>
          </tr>
        </thead>
        <tbody>
          <tr className="listing-ledger-group">
            <th colSpan={8} scope="rowgroup">{heading} <span>{total} {total === 1 ? "listing" : "listings"}</span></th>
          </tr>
          {listings.map((listing) => {
            const photo = realPhoto(listing.photos);
            const price = headlinePrice(listing);
            return (
              <tr className="listing-ledger-row" key={listing.id}>
                <th scope="row">
                  <div className="listing-ledger-title">
                    <div className="listing-ledger-thumb">{photo ? <img src={photo} alt="" loading="lazy" /> : <i aria-hidden="true" />}</div>
                    <Link href={`/listings/${listing.id}`} prefetch={false}>{listing.title}</Link>
                    {listing.offerType !== "Sale" ? <span className="listing-status">{listing.offerType}</span> : null}
                    {listing.listingStatus !== "Available" ? <span className={`listing-status ${statusClass(listing.listingStatus)}`}>{listing.listingStatus}</span> : null}
                    {isAdmin && listing.workflowStatus === "Draft" ? <span className="listing-draft-badge">Draft</span> : null}
                  </div>
                </th>
                <td>{[listing.neighborhoodName, listing.estate].filter(Boolean).join(" · ")}</td>
                <td>{listing.landUse || "—"}</td>
                <td className="listing-num">{listing.sizeSqm ? `${formatSqm(listing.sizeSqm)} m²` : "—"}</td>
                <td className="listing-num" title={listing.converted ? `Listed at ${quotedPrice(listing)}` : undefined}>
                  {listing.askingPrice ? formatFullPrice(listing.askingPrice) : price.label === "Asking" ? "—" : price.value || "—"}
                </td>
                <td className="listing-num">{formatNaira(listing.pricePerSqm)}</td>
                <td>{compareNote(listing, areaMedians).replace(` the ${listing.neighborhoodName} median`, "").replace(/^At$/, "At the median") || "—"}</td>
                <td>{listing.titleDocument || "Not stated"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function buildStats(listings) {
  const sizes = listings.map((listing) => listing.sizeSqm).filter((size) => size > 0);
  return {
    count: listings.length,
    median: medianRate(listings),
    typicalSize: sizes.length ? Math.round(quantile(sizes, 0.5)) : 0
  };
}

function formatFullPrice(value) {
  const price = Number(value) || 0;
  return price ? `₦${new Intl.NumberFormat("en-US").format(price)}` : "—";
}

function statusClass(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "-");
}

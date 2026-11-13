"use client";

import Link from "next/link";
import { Grid2X2, List, Plus, RotateCcw } from "lucide-react";
import PlotCard from "@/components/PlotCard";
import { photoCredits } from "@/lib/photos";
import { formatNaira, formatSqm, realPhoto } from "@/lib/plot";
import { useMemo, useState } from "react";

const landUses = ["Residential", "Commercial", "Mixed-use"];

export default function ListingsClient({ initialListings, neighborhoods, estates, initialView = "cards", initialLocation = "all", isAdmin = false }) {
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
      .filter((listing) => estate === "all" || listing.estate === estate)
      .filter((listing) => listing.askingPrice >= minPriceValue && listing.askingPrice <= maxPriceValue)
      .filter((listing) => listing.sizeSqm >= minSizeValue && listing.sizeSqm <= maxSizeValue)
      .filter((listing) => {
        if (!needle) return true;
        return [listing.title, listing.neighborhoodName, listing.estate, listing.landUse, listing.titleDocument, listing.listingStatus]
          .some((value) => String(value || "").toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sortBy === "price-high") return b.askingPrice - a.askingPrice;
        if (sortBy === "price-low") return a.askingPrice - b.askingPrice;
        if (sortBy === "size-high") return b.sizeSqm - a.sizeSqm;
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });
  }, [estate, initialListings, isAdmin, landUse, location, maxPrice, maxSize, minPrice, minSize, query, sortBy]);

  const groups = useMemo(() => groupByLocation(visibleListings), [visibleListings]);
  const stats = useMemo(() => buildStats(visibleListings), [visibleListings]);

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
      ) : view === "cards" ? (
        <ListingCards groups={groups} isAdmin={isAdmin} />
      ) : (
        <ListingLedger groups={groups} isAdmin={isAdmin} />
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
      , <strong>{stats.available}</strong> available
      {stats.value ? <>, <strong>{formatNaira(stats.value)}</strong> asking in total</> : null}
      {stats.avgSize ? <>, <strong>{formatSqm(stats.avgSize)} m²</strong> on average</> : null}
      .
    </p>
  );
}

function ListingCards({ groups, isAdmin }) {
  // One scale for every plot on the page, so sizes can be compared by eye.
  const scaleSqm = Math.max(0, ...groups.flatMap((group) => group.listings.map((listing) => Number(listing.sizeSqm) || 0)));
  return (
    <>
      {/* Each area takes as many columns as it has listings, so short groups sit side by side. */}
      <div className="listing-card-groups">
        {groups.map((group) => (
          <section className="listing-group" data-span={Math.min(group.listings.length, 4)} key={group.key}>
            <h2>{group.name} <span>{group.listings.length} {group.listings.length === 1 ? "listing" : "listings"}</span></h2>
            <div className="listing-card-grid">
              {group.listings.map((listing) => <ListingCard listing={listing} isAdmin={isAdmin} scaleSqm={scaleSqm} key={listing.id} />)}
            </div>
          </section>
        ))}
      </div>
      <p className="sq-photo-credit">Area views are stand-in photos from Wikimedia Commons, not the listed plots. {photoCredits}</p>
    </>
  );
}

function ListingCard({ listing, isAdmin, scaleSqm }) {
  return (
    <PlotCard
      listing={listing}
      scaleSqm={scaleSqm}
      href={isAdmin ? `/listings/new?id=${listing.id}` : undefined}
      badge={isAdmin && listing.workflowStatus === "Draft" ? <span className="listing-draft-badge">Draft</span> : null}
    />
  );
}

function ListingLedger({ groups, isAdmin }) {
  return (
    <div className="listing-ledger">
      <table className="listing-ledger-table">
        <thead>
          <tr>
            <th scope="col">Listing</th>
            <th scope="col">Estate</th>
            <th scope="col">Use</th>
            <th scope="col" className="listing-num">Size</th>
            <th scope="col" className="listing-num">Asking price</th>
            <th scope="col" className="listing-num">Per m²</th>
            <th scope="col">Title document</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key}>
            <tr className="listing-ledger-group">
              <th colSpan={8} scope="rowgroup">{group.name} <span>{group.listings.length} {group.listings.length === 1 ? "listing" : "listings"}</span></th>
            </tr>
            {group.listings.map((listing) => {
              const photo = realPhoto(listing.photos);
              return (
                <tr className="listing-ledger-row" key={listing.id}>
                  <th scope="row">
                    <div className="listing-ledger-title">
                      <div className="listing-ledger-thumb">{photo ? <img src={photo} alt="" loading="lazy" /> : <i aria-hidden="true" />}</div>
                      {isAdmin ? <Link href={`/listings/new?id=${listing.id}`}>{listing.title}</Link> : <span>{listing.title}</span>}
                      {isAdmin && listing.workflowStatus === "Draft" ? <span className="listing-draft-badge">Draft</span> : null}
                    </div>
                  </th>
                  <td>{listing.estate || "—"}</td>
                  <td>{listing.landUse}</td>
                  <td className="listing-num">{formatSqm(listing.sizeSqm)} m²</td>
                  <td className="listing-num">{formatFullPrice(listing.askingPrice)}</td>
                  <td className="listing-num">{formatPerSqm(listing.askingPrice, listing.sizeSqm)}</td>
                  <td>{listing.titleDocument || "—"}</td>
                  <td><span className={`listing-status ${statusClass(listing.listingStatus)}`}>{listing.listingStatus}</span></td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function groupByLocation(listings) {
  const groups = new Map();
  listings.forEach((listing) => {
    const key = listing.neighborhoodId;
    if (!groups.has(key)) groups.set(key, { key, name: listing.neighborhoodName, listings: [] });
    groups.get(key).listings.push(listing);
  });
  return Array.from(groups.values());
}

function buildStats(listings) {
  const count = listings.length;
  const value = listings.reduce((sum, listing) => sum + listing.askingPrice, 0);
  const available = listings.filter((listing) => listing.listingStatus === "Available").length;
  const avgSize = count ? Math.round(listings.reduce((sum, listing) => sum + listing.sizeSqm, 0) / count) : 0;
  return { count, value, available, avgSize };
}

function formatFullPrice(value) {
  const price = Number(value) || 0;
  return price ? `₦${new Intl.NumberFormat("en-US").format(price)}` : "—";
}

function formatPerSqm(price, size) {
  const perSqm = (Number(price) || 0) / (Number(size) || 0);
  return Number.isFinite(perSqm) && perSqm > 0 ? formatNaira(perSqm) : "—";
}

function statusClass(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "-");
}

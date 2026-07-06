"use client";

import Link from "next/link";
import { Grid2X2, List, Plus, Search } from "lucide-react";
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

  return (
    <section className="listings-page">
      <header className="listings-header">
        <div>
          <h1>Land listings</h1>
          <p>{visibleListings.length} of {initialListings.length} listings shown</p>
        </div>
        <div className="listing-header-actions">
          <div className="listing-view-toggle" aria-label="Listing view">
            <button className={view === "cards" ? "active" : ""} type="button" onClick={() => switchView("cards")} aria-label="Card view">
              <Grid2X2 size={16} /> Cards
            </button>
            <button className={view === "ledger" ? "active" : ""} type="button" onClick={() => switchView("ledger")} aria-label="Ledger view">
              <List size={16} /> Ledger
            </button>
          </div>
          <Link className="listing-new-btn" href={isAdmin ? "/listings/new" : "/admin/login?next=%2Flistings%2Fnew"}>
            <Plus size={16} /> New listing
          </Link>
        </div>
      </header>

      <section className="listing-stats">
        <Metric label="Listings" value={stats.count} suffix="tracked" />
        <Metric label="Portfolio value" value={formatCompactPrice(stats.value)} suffix="asking total" />
        <Metric label="Available" value={stats.available} suffix="ready to sell" />
        <Metric label="Avg. size" value={formatNumber(stats.avgSize)} suffix="sqm per plot" />
      </section>

      <section className="listing-filters">
        <label className="listing-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search listings" />
        </label>
        <div className="listing-use-tabs">
          <button className={landUse === "all" ? "active" : ""} type="button" onClick={() => setLandUse("all")}>All uses</button>
          {landUses.map((use) => (
            <button className={landUse === use ? "active" : ""} type="button" onClick={() => setLandUse(use)} key={use}>{use}</button>
          ))}
        </div>
        <select value={estate} onChange={(event) => setEstate(event.target.value)} aria-label="Estate filter">
          <option value="all">All estates</option>
          {estateOptions.map((name) => <option value={name} key={name}>{name}</option>)}
        </select>
        <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} inputMode="numeric" placeholder="Min ₦M" />
        <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputMode="numeric" placeholder="Max ₦M" />
        <input value={minSize} onChange={(event) => setMinSize(event.target.value)} inputMode="numeric" placeholder="Min sqm" />
        <input value={maxSize} onChange={(event) => setMaxSize(event.target.value)} inputMode="numeric" placeholder="Max sqm" />
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort listings">
          <option value="newest">Newest</option>
          <option value="price-high">Price high</option>
          <option value="price-low">Price low</option>
          <option value="size-high">Size high</option>
        </select>
      </section>

      <section className="listing-location-tabs" aria-label="Location filters">
        <button className={location === "all" ? "active" : ""} type="button" onClick={() => selectLocation("all")}>All</button>
        {locationOptions.map((neighborhood) => (
          <button className={location === neighborhood.id ? "active" : ""} type="button" onClick={() => selectLocation(neighborhood.id)} key={neighborhood.id}>
            {neighborhood.name}
          </button>
        ))}
      </section>

      {view === "cards" ? <ListingCards groups={groups} isAdmin={isAdmin} /> : <ListingLedger groups={groups} isAdmin={isAdmin} />}

      {!visibleListings.length ? (
        <div className="listing-empty">
          <strong>No listings found</strong>
          <p>Adjust the filters or publish a new land listing.</p>
        </div>
      ) : null}
    </section>
  );
}

function ListingCards({ groups, isAdmin }) {
  return (
    <div className="listing-card-groups">
      {groups.map((group) => (
        <section className="listing-group" key={group.key}>
          <h2>{group.name} <span>{group.listings.length} listings</span></h2>
          <div className="listing-card-grid">
            {group.listings.map((listing) => <ListingCard listing={listing} isAdmin={isAdmin} key={listing.id} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function ListingCard({ listing, isAdmin }) {
  const content = (
    <article className="listing-card">
      <ListingMedia listing={listing} />
      <div className="listing-card-body">
        <div>
          <strong>{listing.title}</strong>
          <p>{formatNumber(listing.sizeSqm)} sqm · {listing.landUse}</p>
          <p>{listing.neighborhoodName}{listing.estate ? ` · ${listing.estate}` : ""}</p>
        </div>
        <footer>
          <TitleBadge titleDocument={listing.titleDocument} />
          {isAdmin && listing.workflowStatus === "Draft" ? <span className="listing-draft-badge">Draft</span> : null}
        </footer>
      </div>
    </article>
  );
  return isAdmin ? <Link href={`/listings/new?id=${listing.id}`}>{content}</Link> : content;
}

function ListingMedia({ listing, compact = false }) {
  return (
    <div className={`listing-media ${compact ? "compact" : ""}`}>
      {listing.photos[0] ? <img src={listing.photos[0]} alt="" /> : <div className="listing-photo-fallback" />}
      <span className={`listing-status ${statusClass(listing.listingStatus)}`}>{listing.listingStatus}</span>
      <b>{listing.askingPrice ? formatCompactPrice(listing.askingPrice) : "Price not set"}</b>
    </div>
  );
}

function ListingLedger({ groups, isAdmin }) {
  return (
    <div className="listing-ledger">
      <div className="listing-ledger-head">
        <span>Listing</span>
        <span>Estate</span>
        <span>Size</span>
        <span>Use</span>
        <span>Price</span>
        <span>Title</span>
        <span>Status</span>
      </div>
      {groups.map((group) => (
        <section className="listing-ledger-group" key={group.key}>
          <h2>{group.name} <span>{group.listings.length}</span></h2>
          {group.listings.map((listing) => {
            const row = (
              <article className="listing-ledger-row">
                <div className="listing-ledger-title">
                  <ListingMedia listing={listing} compact />
                  <strong>{listing.title}</strong>
                </div>
                <span>{listing.estate || "-"}</span>
                <span>{formatNumber(listing.sizeSqm)} sqm</span>
                <span>{listing.landUse}</span>
                <span>{formatFullPrice(listing.askingPrice)}</span>
                <TitleBadge titleDocument={listing.titleDocument} />
                <span className={`listing-status ${statusClass(listing.listingStatus)}`}>{listing.listingStatus}</span>
              </article>
            );
            return isAdmin ? <Link href={`/listings/new?id=${listing.id}`} key={listing.id}>{row}</Link> : <div key={listing.id}>{row}</div>;
          })}
        </section>
      ))}
    </div>
  );
}

function Metric({ label, value, suffix }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{suffix}</em>
    </article>
  );
}

function TitleBadge({ titleDocument }) {
  return <span className={`title-badge ${titleClass(titleDocument)}`}><i />{titleDocument}</span>;
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

function formatCompactPrice(value) {
  const price = Number(value) || 0;
  if (!price) return "Price not set";
  if (price >= 1000000000) return `₦${trimDecimal(price / 1000000000)}B`;
  return `₦${Math.round(price / 1000000)}M`;
}

function formatFullPrice(value) {
  const price = Number(value) || 0;
  return price ? `₦${new Intl.NumberFormat("en-US").format(price)}` : "-";
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

function trimDecimal(value) {
  return Number(value.toFixed(1)).toString();
}

function statusClass(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "-");
}

function titleClass(titleDocument) {
  if (/consent/i.test(titleDocument)) return "consent";
  if (/excision/i.test(titleDocument)) return "excision";
  if (/gazette/i.test(titleDocument)) return "gazette";
  return "cofo";
}

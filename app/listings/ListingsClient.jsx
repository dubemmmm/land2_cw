"use client";

import Link from "next/link";
import { ChevronDown, Grid2X2, LandPlot, List, MapPin, Plus, RotateCcw, Search } from "lucide-react";
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
          <p className="cw-lede">{visibleListings.length} of {initialListings.length} listings shown, grouped by area.</p>
        </div>
        <div className="listing-header-actions">
          <div className="cw-tabs listing-view-toggle" role="group" aria-label="Listing view">
            <button className={view === "cards" ? "active" : ""} type="button" onClick={() => switchView("cards")} aria-label="Card view" aria-pressed={view === "cards"}>
              <Grid2X2 size={15} /> Cards
            </button>
            <button className={view === "ledger" ? "active" : ""} type="button" onClick={() => switchView("ledger")} aria-label="Ledger view" aria-pressed={view === "ledger"}>
              <List size={15} /> Ledger
            </button>
          </div>
          <Link className="cw-btn cw-btn-navy listing-new-btn" href={isAdmin ? "/listings/new" : "/admin/login?next=%2Flistings%2Fnew"}>
            <Plus size={16} /> New listing
          </Link>
        </div>
      </header>

      <section className="listing-stats" aria-label="Listing summary">
        <Metric label="Listings" value={stats.count} suffix="tracked" />
        <Metric label="Portfolio value" value={formatCompactPrice(stats.value)} suffix="asking total" />
        <Metric label="Available" value={stats.available} suffix="ready to sell" />
        <Metric label="Avg. size" value={formatNumber(stats.avgSize)} suffix="sqm per plot" />
      </section>

      <section className="listing-filters" aria-label="Listing filters">
        <div className="listing-filter-fields">
          <label className="cw-field listing-filter-search">
            <span>Search</span>
            <span className="listing-search">
              <Search size={16} aria-hidden="true" />
              <input className="cw-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, area, estate or document" />
            </span>
          </label>
          <label className="cw-field listing-filter-estate">
            <span>Estate</span>
            <span className="listing-select">
              <select className="cw-select" value={estate} onChange={(event) => setEstate(event.target.value)} aria-label="Estate filter">
                <option value="all">All estates</option>
                {estateOptions.map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </label>
          <div className="cw-field listing-filter-range" role="group" aria-label="Price range in millions of naira">
            <span>Price (₦M)</span>
            <div>
              <input className="cw-input" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} inputMode="numeric" placeholder="Min" aria-label="Minimum price in millions of naira" />
              <input className="cw-input" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputMode="numeric" placeholder="Max" aria-label="Maximum price in millions of naira" />
            </div>
          </div>
          <div className="cw-field listing-filter-range" role="group" aria-label="Plot size range in square metres">
            <span>Size (sqm)</span>
            <div>
              <input className="cw-input" value={minSize} onChange={(event) => setMinSize(event.target.value)} inputMode="numeric" placeholder="Min" aria-label="Minimum size in square metres" />
              <input className="cw-input" value={maxSize} onChange={(event) => setMaxSize(event.target.value)} inputMode="numeric" placeholder="Max" aria-label="Maximum size in square metres" />
            </div>
          </div>
          <label className="cw-field listing-filter-sort">
            <span>Sort by</span>
            <span className="listing-select">
              <select className="cw-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort listings">
                <option value="newest">Newest</option>
                <option value="price-high">Price high</option>
                <option value="price-low">Price low</option>
                <option value="size-high">Size high</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </label>
          <button className="cw-btn cw-btn-navy listing-reset-btn" type="button" onClick={resetFilters}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>

        <div className="listing-chip-rows">
          <div className="listing-chip-row">
            <span>Land use</span>
            <div className="listing-use-tabs" role="group" aria-label="Land use filters">
              <button className={landUse === "all" ? "active" : ""} type="button" onClick={() => setLandUse("all")}>All uses</button>
              {landUses.map((use) => (
                <button className={landUse === use ? "active" : ""} type="button" onClick={() => setLandUse(use)} key={use}>{use}</button>
              ))}
            </div>
          </div>
          <div className="listing-chip-row">
            <span>Area</span>
            <div className="listing-location-tabs" role="group" aria-label="Location filters">
              <button className={location === "all" ? "active" : ""} type="button" onClick={() => selectLocation("all")}>All areas</button>
              {locationOptions.map((neighborhood) => (
                <button className={location === neighborhood.id ? "active" : ""} type="button" onClick={() => selectLocation(neighborhood.id)} key={neighborhood.id}>
                  {neighborhood.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {!visibleListings.length ? (
        <div className="listing-empty">
          <strong>No listings found</strong>
          <p>Adjust the filters or publish a new land listing.</p>
        </div>
      ) : view === "cards" ? (
        <ListingCards groups={groups} isAdmin={isAdmin} />
      ) : (
        <ListingLedger groups={groups} isAdmin={isAdmin} />
      )}
    </section>
  );
}

function ListingCards({ groups, isAdmin }) {
  return (
    <div className="listing-card-groups">
      {groups.map((group) => (
        <section className="listing-group" key={group.key}>
          <h2>{group.name} <span>{group.listings.length} {group.listings.length === 1 ? "listing" : "listings"}</span></h2>
          <div className="listing-card-grid">
            {group.listings.map((listing) => <ListingCard listing={listing} isAdmin={isAdmin} key={listing.id} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function ListingCard({ listing, isAdmin }) {
  const perSqm = formatPricePerSqm(listing.askingPrice, listing.sizeSqm);
  const content = (
    <article className="listing-card">
      <div className="listing-media">
        <ListingPhoto listing={listing} />
        <div className="listing-media-chips">
          <span className={`listing-status ${statusClass(listing.listingStatus)}`}>{listing.listingStatus}</span>
          <TitleBadge titleDocument={listing.titleDocument} />
          {isAdmin && listing.workflowStatus === "Draft" ? <span className="listing-draft-badge">Draft</span> : null}
        </div>
        <span className="listing-media-place">
          <MapPin size={13} aria-hidden="true" />
          <span>{listing.neighborhoodName}{listing.estate ? ` · ${listing.estate}` : ""}</span>
        </span>
      </div>
      <div className="listing-card-body">
        <b className="listing-card-price">{listing.askingPrice ? formatCompactPrice(listing.askingPrice) : "Price not set"}</b>
        <strong>{listing.title}</strong>
        <p className="listing-card-meta">
          <span>{formatNumber(listing.sizeSqm)} sqm</span>
          {perSqm ? <span>{perSqm}</span> : null}
          <span>{listing.landUse}</span>
        </p>
      </div>
    </article>
  );
  return isAdmin ? <Link className="listing-card-link" href={`/listings/new?id=${listing.id}`}>{content}</Link> : content;
}

function ListingPhoto({ listing }) {
  return listing.photos[0]
    ? <img src={listing.photos[0]} alt="" />
    : <div className="listing-photo-fallback" aria-hidden="true"><LandPlot size={26} strokeWidth={1.5} /></div>;
}

function ListingLedger({ groups, isAdmin }) {
  return (
    <div className="listing-ledger">
      <div className="listing-ledger-inner">
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
                    <div className="listing-media compact"><ListingPhoto listing={listing} /></div>
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
    </div>
  );
}

function Metric({ label, value, suffix }) {
  return (
    <article>
      <strong className="cw-stat-num">{value}</strong>
      <span className="cw-stat-label"><b>{label}</b> {suffix}</span>
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

function formatPricePerSqm(price, size) {
  const perSqm = (Number(price) || 0) / (Number(size) || 0);
  if (!Number.isFinite(perSqm) || perSqm <= 0) return "";
  if (perSqm >= 1000000) return `₦${trimDecimal(perSqm / 1000000)}M/sqm`;
  if (perSqm >= 1000) return `₦${Math.round(perSqm / 1000)}k/sqm`;
  return `₦${Math.round(perSqm)}/sqm`;
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

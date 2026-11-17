"use client";

import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isComparable } from "@/lib/listingMath";
import { formatNaira, formatSqm, headlinePrice, quotedPrice, realPhoto } from "@/lib/plot";

const PAGE_SIZE = 30;
const landUses = ["Residential", "Commercial", "Mixed-use", "Industrial"];
const offerTypes = ["Sale", "Joint venture", "Lease"];

/* ---------- The price scale shared by the map, the chart and the rows ---------- */
// Asking prices per m² run from tens of thousands to several million naira, so
// the scale is logarithmic: equal steps are equal multiples.
const AXIS_MIN = 20_000;
const AXIS_MAX = 12_000_000;
const AXIS_TICKS = [50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000];
const RAMP = ["#d3ebe6", "#94cdc3", "#4fa59a", "#1b756d", "#084744"];
const RAMP_MIN = 100_000;
const RAMP_MAX = 6_000_000;

function rampPosition(value) {
  const t = (Math.log(value) - Math.log(RAMP_MIN)) / (Math.log(RAMP_MAX) - Math.log(RAMP_MIN));
  return Math.max(0, Math.min(1, t));
}

// One hue, light to dark: the darker the mark, the higher the asking price per m².
function priceColor(value) {
  if (!value) return "#ffffff";
  const scaled = rampPosition(value) * (RAMP.length - 1);
  const index = Math.min(RAMP.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const from = RAMP[index].match(/\w\w/g).map((hex) => parseInt(hex, 16));
  const to = RAMP[index + 1].match(/\w\w/g).map((hex) => parseInt(hex, 16));
  return `rgb(${from.map((channel, i) => Math.round(channel + (to[i] - channel) * mix)).join(", ")})`;
}

// A steady up-or-down offset per plot, so marks at the same price do not sit on top of each other.
function spread(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 1000) / 1000) * 2 - 1;
}

const short = (value) => formatNaira(value).replace("₦", "");
const tenth = (value) => Math.round(value * 10) / 10;

export default function ExploreClient({ listings, areas, fx = null, initialArea = "all", isAdmin = false }) {
  const [area, setArea] = useState(areas.some((item) => item.id === initialArea) ? initialArea : "all");
  const [query, setQuery] = useState("");
  const [landUse, setLandUse] = useState("all");
  const [offer, setOffer] = useState("all");
  const [budget, setBudget] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [shown, setShown] = useState(PAGE_SIZE);
  // The plot under the pointer, wherever it was pointed at: its row and its mark light up together.
  const [hot, setHot] = useState(null);
  const [hotArea, setHotArea] = useState(null);

  const panelRef = useRef(null);
  // Counts are taken from the plots this viewer can see, so they always agree with the list.
  const counted = useMemo(() => {
    const counts = new Map();
    for (const listing of listings) counts.set(listing.neighborhoodId, (counts.get(listing.neighborhoodId) || 0) + 1);
    return areas.map((item) => (item.id === "all-lagos" ? { ...item, count: listings.length } : { ...item, count: counts.get(item.id) || 0 }));
  }, [areas, listings]);
  const areaById = useMemo(() => new Map(counted.map((item) => [item.id, item])), [counted]);
  const current = area === "all" ? null : areaById.get(area);
  const budgetNaira = (Number(String(budget).replace(/[^\d.]/g, "")) || 0) * 1_000_000;

  // Everything except the area: what the chart dims, and what the list starts from.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (listing) => {
      if (!isAdmin && listing.workflowStatus !== "Published") return false;
      if (landUse !== "all" && listing.landUse !== landUse) return false;
      if (offer !== "all" && listing.offerType !== offer) return false;
      if (budgetNaira && !(listing.askingPrice > 0 && listing.askingPrice <= budgetNaira)) return false;
      if (needle && ![listing.title, listing.neighborhoodName, listing.estate, listing.titleDocument, listing.sourceId].some((value) => String(value || "").toLowerCase().includes(needle))) return false;
      return true;
    };
  }, [budgetNaira, isAdmin, landUse, offer, query]);

  const visible = useMemo(() => {
    return listings
      .filter((listing) => (area === "all" || listing.neighborhoodId === area) && matches(listing))
      .sort((a, b) => {
        if (sortBy === "rate-low") return (a.pricePerSqm || Infinity) - (b.pricePerSqm || Infinity);
        if (sortBy === "price-low") return (a.askingPrice || Infinity) - (b.askingPrice || Infinity);
        if (sortBy === "size-high") return b.sizeSqm - a.sizeSqm;
        return String(b.listedAt).localeCompare(String(a.listedAt));
      });
  }, [area, listings, matches, sortBy]);

  const filtersOn = Boolean(query || budget || landUse !== "all" || offer !== "all");

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [area, budget, landUse, offer, query, sortBy]);

  function choose(next) {
    const value = next === area ? "all" : next;
    setArea(value);
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete("location");
    else params.set("location", value);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `/listings?${search}` : "/listings");
    panelRef.current?.scrollTo({ top: 0 });
  }

  function clearFilters() {
    setQuery("");
    setBudget("");
    setLandUse("all");
    setOffer("all");
  }

  const total = area === "all" ? listings.length : current.count;
  const overall = areaById.get("all-lagos");

  return (
    <div className="ex">
      <section className="ex-map" aria-label="Map of areas">
        <AreaMap areas={counted.filter((item) => item.center && item.count)} selected={area} hovered={hotArea} onChoose={choose} onHover={setHotArea} />
        <div className="ex-legend">
          <b>Median asking price per m²</b>
          <div className="ex-legend-ramp" />
          <div className="ex-legend-ends"><span>₦{short(RAMP_MIN)}</span><span>₦{short(RAMP_MAX)} and over</span></div>
          <p>Circle size shows how many plots are listed. A dashed circle has too few priced plots for a median.</p>
        </div>
      </section>

      <section className="ex-panel" aria-label="Plots" ref={panelRef}>
        <header className="ex-head">
          {current ? (
            <button className="ex-back" type="button" onClick={() => choose("all")}><ArrowLeft size={15} aria-hidden="true" /> All of Lagos</button>
          ) : null}
          <h1>{current ? current.name : "Land on the market in Lagos"}</h1>
          {current ? (
            <p className="ex-lede">
              <b>{current.count} {current.count === 1 ? "plot" : "plots"}</b> on the market.{" "}
              {current.median ? (
                <>Sellers are asking a median of <b>{formatNaira(current.median)} per m²</b>; the middle half fall between {formatNaira(current.q1)} and {formatNaira(current.q3)}.{" "}</>
              ) : (
                <>Too few of them are priced per m² to give a median yet.{" "}</>
              )}
              <Link href={`/locations/${current.id}`}>Planning rules and area profile →</Link>
            </p>
          ) : (
            <p className="ex-lede">
              <b>{listings.length} plots</b> across {counted.filter((item) => item.count && item.center).length} areas.
              {overall?.median ? <> Sellers are asking a median of <b>{formatNaira(overall.median)} per m²</b>.</> : null}{" "}
              Pick an area on the map or in the chart to look closer.
            </p>
          )}
        </header>

        <PriceStrip
          areas={counted.filter((item) => item.center && item.count)}
          listings={listings}
          selected={area}
          matches={matches}
          hot={hot}
          hotArea={hotArea}
          onHot={setHot}
          onHotArea={setHotArea}
          onChoose={choose}
        />

        <div className="ex-controls" role="group" aria-label="Narrow the list">
          <label className={`ex-field ex-field-search ${query ? "is-set" : ""}`}>
            <Search size={15} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, estate or reference" aria-label="Search plots" />
          </label>
          <label className={`ex-field ex-field-budget ${budget ? "is-set" : ""}`} title="Show plots whose whole asking price is within this budget">
            Budget ₦
            <input value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" placeholder="any" aria-label="Budget in millions of naira" />
            million
          </label>
          <label className={`ex-field ${landUse !== "all" ? "is-set" : ""}`}>
            <select value={landUse} onChange={(event) => setLandUse(event.target.value)} aria-label="Land use">
              <option value="all">Any use</option>
              {landUses.map((use) => <option key={use}>{use}</option>)}
            </select>
          </label>
          <label className={`ex-field ${offer !== "all" ? "is-set" : ""}`}>
            <select value={offer} onChange={(event) => setOffer(event.target.value)} aria-label="Offer type">
              <option value="all">Any offer</option>
              {offerTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="ex-field">
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort plots">
              <option value="newest">Newest first</option>
              <option value="rate-low">Lowest price per m²</option>
              <option value="price-low">Lowest total price</option>
              <option value="size-high">Largest first</option>
            </select>
          </label>
          {filtersOn ? <button className="ex-clear" type="button" onClick={clearFilters}>Clear</button> : null}
        </div>

        <p className="ex-count" role="status">
          {filtersOn
            ? <><b>{visible.length}</b> of {total} plots{current ? ` in ${current.name}` : ""} match{budgetNaira ? <> a budget of <b>{formatNaira(budgetNaira)}</b></> : null}.</>
            : <><b>{visible.length}</b> {visible.length === 1 ? "plot" : "plots"}{current ? ` in ${current.name}` : ""}, newest first.</>}
        </p>

        {visible.length ? (
          <ul className="ex-rows">
            {visible.slice(0, shown).map((listing) => (
              <li key={listing.id}>
                <PlotRow listing={listing} area={areaById.get(listing.neighborhoodId)} showArea={!current} hot={hot === listing.id} onHot={setHot} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="ex-empty">No plots match. Raise the budget or clear the filters to see more.</p>
        )}
        {shown < visible.length ? (
          <div className="ex-more">
            <button type="button" onClick={() => setShown((count) => count + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, visible.length - shown)} more</button>
            <span>Showing {shown} of {visible.length}</span>
          </div>
        ) : null}

        <p className="ex-foot">
          Prices are what sellers are asking, not sale prices. Medians and the chart leave out joint ventures, leases and plots with no price per m².
          {fx && listings.some((listing) => listing.converted) ? <> Dollar prices are converted at ₦{new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(fx.rate)} to the dollar{fx.asOf ? ` (rate of ${fx.asOf})` : ""}, with <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">rates by Exchange Rate API</a>.</> : null}
          {isAdmin ? <> <Link href="/listings/new">Add a listing</Link>.</> : null}
        </p>
      </section>
    </div>
  );
}

/* ---------- One plot in the list ---------- */
function PlotRow({ listing, area, showArea, hot, onHot }) {
  const photo = realPhoto(listing.photos);
  const price = headlinePrice(listing);
  const tags = [listing.offerType !== "Sale" ? listing.offerType : "", listing.workflowStatus === "Draft" ? "Draft" : "", listing.listingStatus !== "Available" ? listing.listingStatus : ""].filter(Boolean);
  const where = [showArea ? listing.neighborhoodName : "", listing.estate, listing.landUse, listing.titleDocument].filter(Boolean).join(" · ");
  return (
    <Link
      className={`ex-row ${hot ? "is-hover" : ""}`}
      href={`/listings/${listing.id}`}
      prefetch={false}
      onMouseEnter={() => onHot(listing.id)}
      onMouseLeave={() => onHot(null)}
      onFocus={() => onHot(listing.id)}
      onBlur={() => onHot(null)}
    >
      <span className="ex-row-main">
        {photo ? <img className="ex-row-photo" src={photo} alt="" loading="lazy" /> : null}
        <span style={{ minWidth: 0 }}>
          <span className="ex-row-title">{listing.title}</span>
          <span className="ex-row-meta">
            {tags.map((tag) => <em key={tag}>{tag}</em>)}{tags.length ? " " : ""}{where}
          </span>
        </span>
      </span>
      <span className="ex-num ex-num-size">
        <b>{listing.sizeSqm ? formatSqm(listing.sizeSqm) : "—"}</b>
        <small>m²</small>
      </span>
      <span className="ex-num">
        <b>{price.value || "—"}</b>
        <small>
          {listing.askingPrice && listing.pricePerSqm ? `${formatNaira(listing.pricePerSqm)}/m²` : price.label === "Asking" ? "asking" : price.label.toLowerCase()}
          {listing.converted ? ` · from ${quotedPrice(listing).split(" ")[0]}` : ""}
        </small>
      </span>
      <Gauge listing={listing} area={area} />
    </Link>
  );
}

// Where the plot's price per m² sits within its area, a quarter to four times the median.
function Gauge({ listing, area }) {
  if (!area?.median || !isComparable(listing)) return <span className="ex-gauge-none" aria-hidden="true">—</span>;
  const at = (value) => `${tenth(Math.max(0, Math.min(100, ((Math.log(value / area.median) / Math.log(4) + 1) / 2) * 100)))}%`;
  const diff = Math.round((listing.pricePerSqm / area.median - 1) * 100);
  const label = Math.abs(diff) < 3 ? `At the ${area.name} median` : `${Math.abs(diff)}% ${diff > 0 ? "above" : "below"} the ${area.name} median`;
  return (
    <span className="ex-gauge" role="img" aria-label={label} title={label}>
      <i style={{ left: at(area.q1), width: `calc(${at(area.q3)} - ${at(area.q1)})` }} />
      <u style={{ left: "50%" }} />
      <b style={{ left: at(listing.pricePerSqm), background: priceColor(listing.pricePerSqm) }} />
    </span>
  );
}

/* ---------- The chart: every priced plot as one mark, a row per area ---------- */
const ROW_H = 38;
const AXIS_H = 26;
const LABEL_W = 132;

function PriceStrip({ areas, listings, selected, matches, hot, hotArea, onHot, onHotArea, onChoose }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(560);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => [...areas].sort((a, b) => (b.median || 0) - (a.median || 0) || b.count - a.count), [areas]);
  const rowOf = useMemo(() => new Map(rows.map((row, index) => [row.id, index])), [rows]);
  const left = width < 440 ? 96 : LABEL_W;
  const plotW = width - left - 10;
  // Positions are rounded to a tenth of a pixel so the server and the browser,
  // whose logarithms can differ in the last decimal place, draw the same markup.
  const x = (value) => tenth(left + ((Math.log(Math.max(AXIS_MIN, Math.min(AXIS_MAX, value))) - Math.log(AXIS_MIN)) / (Math.log(AXIS_MAX) - Math.log(AXIS_MIN))) * plotW);
  const yMid = (index) => AXIS_H + index * ROW_H + ROW_H / 2;
  const height = AXIS_H + rows.length * ROW_H + 6;
  const ticks = width < 440 ? AXIS_TICKS.filter((_, index) => index % 2 === 1) : AXIS_TICKS;

  const marks = useMemo(() => listings
    .filter((listing) => isComparable(listing) && rowOf.has(listing.neighborhoodId))
    .map((listing) => ({ listing, row: rowOf.get(listing.neighborhoodId), offset: tenth(spread(listing.id) * 11) })), [listings, rowOf]);
  const hotMark = hot ? marks.find((mark) => mark.listing.id === hot) : null;

  function showTip(mark) {
    onHot(mark.listing.id);
    setTip({ x: x(mark.listing.pricePerSqm), y: yMid(mark.row) + mark.offset, listing: mark.listing });
  }

  return (
    <div className="ex-strip" ref={wrapRef}>
      <h2>What sellers are asking, per m²</h2>
      <p className="ex-strip-note">Each mark is one plot. The bar is the area&rsquo;s median. Further right and darker means dearer.</p>
      <svg height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Asking price per square metre of every plot, by area. The same plots are listed below.">
        <g className="ex-strip-axis">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1={AXIS_H - 4} y2={height - 6} />
              <text x={x(tick)} y={12} textAnchor="middle">₦{short(tick)}</text>
            </g>
          ))}
        </g>
        {rows.map((row, index) => {
          const dim = selected !== "all" && selected !== row.id;
          const on = selected === row.id || hotArea === row.id;
          return (
            <g
              key={row.id}
              className={`ex-strip-row ${on ? "is-on" : ""} ${dim ? "is-dim" : ""}`}
              onClick={() => onChoose(row.id)}
              onMouseEnter={() => onHotArea(row.id)}
              onMouseLeave={() => onHotArea(null)}
            >
              <rect className="hit" x={0} y={AXIS_H + index * ROW_H} width={width} height={ROW_H} rx={6} />
              <text className="ex-strip-name" x={8} y={yMid(index) - 2}>{row.name}</text>
              <text className="ex-strip-count" x={8} y={yMid(index) + 12}>{row.count} {row.count === 1 ? "plot" : "plots"}</text>
            </g>
          );
        })}
        {marks.map((mark) => {
          const dim = selected !== "all" && selected !== mark.listing.neighborhoodId;
          return (
            <circle
              key={mark.listing.id}
              className={`ex-dot ${dim || !matches(mark.listing) ? "is-out" : ""}`}
              cx={x(mark.listing.pricePerSqm)}
              cy={yMid(mark.row) + mark.offset}
              r={3}
              fill={priceColor(mark.listing.pricePerSqm)}
              onMouseEnter={() => showTip(mark)}
              onMouseLeave={() => { onHot(null); setTip(null); }}
              onClick={() => { window.location.assign(`/listings/${mark.listing.id}`); }}
              style={{ cursor: "pointer" }}
            />
          );
        })}
        {rows.map((row, index) => row.median ? (
          <g key={row.id} pointerEvents="none" opacity={selected !== "all" && selected !== row.id ? 0.3 : 1}>
            <line className="ex-strip-median" x1={x(row.median)} x2={x(row.median)} y1={yMid(index) - 14} y2={yMid(index) + 14} />
            {selected === row.id || hotArea === row.id ? (
              <text className="ex-strip-median-label" x={x(row.median)} y={yMid(index) - 17} textAnchor="middle">median ₦{short(row.median)}</text>
            ) : null}
          </g>
        ) : null)}
        {hotMark ? <circle className="ex-dot-hot" cx={x(hotMark.listing.pricePerSqm)} cy={yMid(hotMark.row) + hotMark.offset} r={6} /> : null}
      </svg>
      {tip ? (
        <div className="ex-tip" style={{ left: Math.max(130, Math.min(width - 130, tip.x)), top: tip.y + 64 }} role="tooltip">
          <b>{tip.listing.title}</b>
          <span>{formatNaira(tip.listing.pricePerSqm)} per m²{tip.listing.sizeSqm ? ` · ${formatSqm(tip.listing.sizeSqm)} m²` : ""}{tip.listing.askingPrice ? ` · ${formatNaira(tip.listing.askingPrice)}` : ""}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- The map: one circle per area ---------- */
function AreaMap({ areas, selected, hovered, onChoose, onHover }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const leafletRef = useRef(null);
  const handlers = useRef({ onChoose, onHover });
  handlers.current = { onChoose, onHover };
  const [ready, setReady] = useState(false);
  const most = Math.max(1, ...areas.map((item) => item.count));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !nodeRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(nodeRef.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: true });
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw the circles, and redraw them when the selection or the pointer moves.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    for (const item of areas) {
      const size = Math.round(34 + 50 * Math.sqrt(item.count / most));
      const state = [
        item.median ? "" : "is-empty",
        item.median && rampPosition(item.median) < 0.42 ? "is-light" : "",
        selected === item.id ? "is-on" : "",
        hovered === item.id ? "is-hover" : "",
        selected !== "all" && selected !== item.id ? "is-dim" : ""
      ].filter(Boolean).join(" ");
      const icon = L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div class="ex-bubble ${state}" style="width:${size}px;height:${size}px;${item.median ? `background:${priceColor(item.median)}` : ""}">${item.count}</div>`
      });
      const marker = L.marker(item.center, { icon, keyboard: true, title: `${item.name}: ${item.count} plots`, zIndexOffset: selected === item.id ? 1000 : 0 }).addTo(map);
      // Names sit above every circle. Where areas crowd together, the small
      // ones are named only when pointed at or chosen.
      const named = item.count >= 20 || selected === item.id || hovered === item.id;
      if (named) {
        const label = L.marker(item.center, {
          interactive: false,
          keyboard: false,
          zIndexOffset: selected === item.id || hovered === item.id ? 3000 : 2000,
          icon: L.divIcon({
            className: "",
            iconSize: [0, 0],
            html: `<div class="ex-bubble-label ${selected === item.id || hovered === item.id ? "is-on" : ""}" style="top:${size / 2 + 5}px">${item.name}${item.median && (selected === item.id || hovered === item.id || selected === "all") ? `<small>₦${short(item.median)}/m²</small>` : ""}</div>`
          })
        }).addTo(map);
        markersRef.current.set(`${item.id}-label`, label);
      }
      marker.on("click", () => handlers.current.onChoose(item.id));
      marker.on("mouseover", () => handlers.current.onHover(item.id));
      marker.on("mouseout", () => handlers.current.onHover(null));
      markersRef.current.set(item.id, marker);
    }
  }, [areas, hovered, most, ready, selected]);

  // Frame the selected area, or all of them.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !areas.length) return;
    const chosen = areas.find((item) => item.id === selected);
    if (chosen) map.flyTo(chosen.center, 13, { duration: 0.6 });
    else map.fitBounds(L.latLngBounds(areas.map((item) => item.center)), { paddingTopLeft: [60, 60], paddingBottomRight: [60, 90], maxZoom: 13 });
  }, [areas, ready, selected]);

  return <div className="ex-map-canvas" ref={nodeRef} />;
}

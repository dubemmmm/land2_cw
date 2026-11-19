"use client";

import Link from "next/link";
import { LayoutGrid, List, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { againstMedian } from "@/lib/listingMath";
import { photo as stockPhoto } from "@/lib/photos";
import { STANDARD_PLOT, formatNaira, formatSqm, headlinePrice, plotOutline, quotedPrice, realPhoto } from "@/lib/plot";

const PAGE_SIZE = 18;

// PREVIEW ONLY: plots with no photo of their own borrow a stand-in view of
// Lagos, to show how the page looks once photos are uploaded. Nothing is saved
// to the listings. Set this to false to go back to drawings alone.
const PREVIEW_PLACEHOLDERS = false;
const STAND_INS = ["ikoyi", "lekki", "victoriaIsland", "bananaIsland", "farmland", "skyline"];
const CROPS = ["50% 30%", "20% 60%", "80% 45%", "50% 75%", "35% 20%"];

function standIn(id) {
  if (!PREVIEW_PLACEHOLDERS) return null;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  hash = Math.abs(hash);
  const picked = stockPhoto(STAND_INS[hash % STAND_INS.length], 960);
  return picked ? { src: picked.src, crop: CROPS[(hash >> 3) % CROPS.length], credit: `${picked.credit}, ${picked.license}` } : null;
}
const landUses = ["Residential", "Commercial", "Mixed-use", "Industrial"];
// The budget slider's stops. The last one means no limit.
const BUDGETS = [50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000, 0].map((millions) => millions * 1_000_000);
// Sizes in the terms Lagos buyers use: a standard plot is 648 m².
const SIZES = [
  { id: "small", label: "Up to 1 plot", hint: "under 700 m²", from: 0, to: 700 },
  { id: "double", label: "1 to 2 plots", hint: "700 to 1,400 m²", from: 700, to: 1400 },
  { id: "several", label: "2 to 5 plots", hint: "1,400 to 3,300 m²", from: 1400, to: 3300 },
  { id: "large", label: "Larger", hint: "over 3,300 m²", from: 3300, to: 0 }
];

// The listings page. Land has no kitchen to photograph: what a buyer compares is
// how big a plot is, what it costs and whether that is fair for the area. So
// every plot is drawn to scale beside a standard Lagos plot, with its price and
// where that price sits in its area.
export default function FindLandClient({ listings, areas, fx = null, initialArea = "all", isAdmin = false }) {
  const [area, setArea] = useState(areas.some((item) => item.id === initialArea && item.id !== "all-lagos") ? initialArea : "all");
  const [query, setQuery] = useState("");
  const [budgetStop, setBudgetStop] = useState(BUDGETS.length - 1);
  const [size, setSize] = useState("");
  const [landUse, setLandUse] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [view, setView] = useState("drawings");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [mapOpen, setMapOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const mine = useMemo(() => listings.filter((listing) => isAdmin || listing.workflowStatus === "Published"), [isAdmin, listings]);
  // Counts come from the plots this viewer can see, so they always agree with the list.
  const places = useMemo(() => {
    const counts = new Map();
    for (const listing of mine) counts.set(listing.neighborhoodId, (counts.get(listing.neighborhoodId) || 0) + 1);
    return areas
      .filter((item) => item.id !== "all-lagos")
      .map((item) => ({ ...item, count: counts.get(item.id) || 0 }))
      .filter((item) => item.count)
      .sort((a, b) => b.count - a.count);
  }, [areas, mine]);
  const placeById = useMemo(() => new Map(places.map((item) => [item.id, item])), [places]);
  const current = placeById.get(area) || null;
  const budget = BUDGETS[budgetStop];
  const sizeBand = SIZES.find((item) => item.id === size) || null;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return mine
      .filter((listing) => {
        if (current && listing.neighborhoodId !== current.id) return false;
        if (budget && !(listing.askingPrice > 0 && listing.askingPrice <= budget)) return false;
        if (sizeBand && !(listing.sizeSqm > 0 && listing.sizeSqm >= sizeBand.from && (!sizeBand.to || listing.sizeSqm < sizeBand.to))) return false;
        if (landUse && listing.landUse !== landUse) return false;
        if (needle && ![listing.title, listing.neighborhoodName, listing.estate, listing.titleDocument, listing.sourceId].some((value) => String(value || "").toLowerCase().includes(needle))) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price-low") return (a.askingPrice || Infinity) - (b.askingPrice || Infinity);
        if (sortBy === "price-high") return (b.askingPrice || 0) - (a.askingPrice || 0);
        if (sortBy === "size-high") return b.sizeSqm - a.sizeSqm;
        return String(b.listedAt).localeCompare(String(a.listedAt));
      });
  }, [budget, current, landUse, mine, query, sizeBand, sortBy]);

  const filterCount = [budget, size, landUse, query].filter(Boolean).length;

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [area, budgetStop, landUse, query, size, sortBy, view]);

  function choose(next) {
    const value = next === area ? "all" : next;
    setArea(value);
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete("location");
    else params.set("location", value);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `/listings?${search}` : "/listings");
  }

  function clearFilters() {
    setQuery("");
    setBudgetStop(BUDGETS.length - 1);
    setSize("");
    setLandUse("");
  }

  return (
    <div className="fl">
      <aside className="fl-side" aria-label="Choose what to see">
        <section className="fl-block">
          <h2>Area</h2>
          <div className="fl-areas">
            <button type="button" className={`fl-area ${!current ? "is-on" : ""}`} aria-pressed={!current} onClick={() => choose("all")}>
              <b>All areas</b>
              <span>{mine.length}</span>
            </button>
            {places.map((place) => (
              <button type="button" className={`fl-area ${area === place.id ? "is-on" : ""}`} aria-pressed={area === place.id} onClick={() => choose(place.id)} key={place.id}>
                <b>{place.name}</b>
                <span>{place.count}</span>
              </button>
            ))}
          </div>
          <button type="button" className="fl-link" aria-expanded={mapOpen} onClick={() => setMapOpen((open) => !open)}>
            {mapOpen ? <X size={15} aria-hidden="true" /> : <MapIcon size={15} aria-hidden="true" />}
            {mapOpen ? "Hide the map" : "See the areas on a map"}
          </button>
        </section>

        <button type="button" className="fl-filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          Budget, size and more{filterCount ? ` (${filterCount} set)` : ""}
        </button>

        <div className={`fl-more-filters ${filtersOpen ? "is-open" : ""}`}>
          <section className="fl-block">
            <h2><label htmlFor="fl-budget">Budget</label></h2>
            <p className="fl-budget-value">{budget ? <>Up to <b>{formatNaira(budget)}</b></> : <b>Any budget</b>}</p>
            <input
              id="fl-budget"
              className="fl-range"
              type="range"
              min="0"
              max={BUDGETS.length - 1}
              step="1"
              value={budgetStop}
              onChange={(event) => setBudgetStop(Number(event.target.value))}
              aria-valuetext={budget ? `Up to ${formatNaira(budget)}` : "Any budget"}
              style={{ "--fill": `${(budgetStop / (BUDGETS.length - 1)) * 100}%` }}
            />
            <div className="fl-range-ends"><span>{formatNaira(BUDGETS[0])}</span><span>Any</span></div>
          </section>

          <section className="fl-block">
            <h2>Plot size</h2>
            <div className="fl-sizes" role="group" aria-label="Plot size">
              {SIZES.map((band, index) => (
                <button type="button" className={`fl-size ${size === band.id ? "is-on" : ""}`} aria-pressed={size === band.id} onClick={() => setSize(size === band.id ? "" : band.id)} key={band.id}>
                  <i aria-hidden="true" style={{ width: 10 + index * 7, height: 6 + index * 4 }} />
                  <b>{band.label}</b>
                  <span>{band.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="fl-block">
            <h2><label htmlFor="fl-use">What the land is for</label></h2>
            <select id="fl-use" className="fl-select" value={landUse} onChange={(event) => setLandUse(event.target.value)}>
              <option value="">Any use</option>
              {landUses.map((use) => <option key={use}>{use}</option>)}
            </select>
          </section>

          <section className="fl-block">
            <h2><label htmlFor="fl-search">Search</label></h2>
            <div className="fl-search">
              <Search size={15} aria-hidden="true" />
              <input id="fl-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Estate, street or reference" />
            </div>
          </section>

          {filterCount ? <button type="button" className="fl-link" onClick={clearFilters}><X size={15} aria-hidden="true" /> Clear these choices</button> : null}
        </div>
      </aside>

      <div className="fl-main">
        <header className="fl-head">
          <h1>{current ? `Land for sale in ${current.name}` : "Land for sale in Lagos"}</h1>
          <p>
            {current
              ? current.median
                ? <>Most sellers in {current.name} ask around <b>{formatNaira(current.median)} per m²</b>. </>
                : null
              : <>Every plot is drawn to scale, so you can see its size before you read a word. </>}
            {current ? <Link href={`/locations/${current.id}`}>About {current.name}</Link> : null}
          </p>
        </header>

        {mapOpen ? (
          <div className="fl-map">
            <AreaMap areas={places.filter((item) => item.center)} selected={area} onChoose={choose} />
          </div>
        ) : null}

        <div className="fl-bar">
          <p role="status">
            <b>{visible.length}</b> {visible.length === 1 ? "plot" : "plots"}
            {budget ? <> up to {formatNaira(budget)}</> : null}
            {filterCount ? <> · <button type="button" className="fl-clear" onClick={clearFilters}>Clear</button></> : null}
          </p>
          <div className="fl-bar-tools">
            <label className="fl-sort">
              <span>Sort by</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">Newest</option>
                <option value="price-low">Lowest price</option>
                <option value="price-high">Highest price</option>
                <option value="size-high">Largest plot</option>
              </select>
            </label>
            <div className="fl-views" role="group" aria-label="How to show the plots">
              <button type="button" className={view === "drawings" ? "is-on" : ""} aria-pressed={view === "drawings"} onClick={() => setView("drawings")}><LayoutGrid size={15} aria-hidden="true" /> Drawings</button>
              <button type="button" className={view === "list" ? "is-on" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} aria-hidden="true" /> List</button>
            </div>
          </div>
        </div>

        {!visible.length ? (
          <div className="fl-empty">
            <p>No plots match these choices.</p>
            <button type="button" className="cw-btn cw-btn-soft" onClick={() => { clearFilters(); choose("all"); }}>Show all plots</button>
          </div>
        ) : view === "drawings" ? (
          <>
            <ul className="fl-grid">
              {visible.slice(0, shown).map((listing) => (
                <li key={listing.id}><PlotSheet listing={listing} place={placeById.get(listing.neighborhoodId)} showArea={!current} /></li>
              ))}
            </ul>
            <p className="fl-key">
              <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden="true"><rect className="fl-draw-std" x="1" y="1" width="32" height="12" /></svg>
              The dashed outline is one standard Lagos plot ({STANDARD_PLOT.sqm} m²), drawn at the same scale as the plot. Each plot's area is exact; its shape is not recorded.
              {PREVIEW_PLACEHOLDERS ? " Photos marked as placeholders are stand-in views of Lagos from Wikimedia Commons, not the plots themselves." : ""}
            </p>
          </>
        ) : (
          <ul className="fl-list">
            {visible.slice(0, shown).map((listing) => (
              <li key={listing.id}><PlotRow listing={listing} place={placeById.get(listing.neighborhoodId)} showArea={!current} /></li>
            ))}
          </ul>
        )}

        {shown < visible.length ? (
          <div className="fl-more">
            <button type="button" className="cw-btn cw-btn-soft" onClick={() => setShown((count) => count + PAGE_SIZE)}>Show more plots</button>
            <span>Showing {shown} of {visible.length}</span>
          </div>
        ) : null}

        <p className="fl-foot">
          Prices are what sellers are asking, not what plots sold for. "Typical" is the middle asking price per m² in that area.
          {fx && mine.some((listing) => listing.converted) ? <> Dollar prices are shown in naira at ₦{new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(fx.rate)} to the dollar{fx.asOf ? ` (rate of ${fx.asOf})` : ""}, with <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">rates by Exchange Rate API</a>.</> : null}
          {isAdmin ? <> <Link href="/data/listings?new=1">Add a listing</Link>.</> : null}
        </p>
      </div>
    </div>
  );
}

/* ---------- What both views say about a plot ---------- */
function describe(listing, place) {
  const price = headlinePrice(listing);
  const diff = againstMedian(listing, place?.median);
  const own = realPhoto(listing.photos);
  const placeholder = own ? null : standIn(listing.id);
  return {
    price,
    photo: own || placeholder?.src || null,
    placeholder,
    flags: [listing.offerType !== "Sale" ? listing.offerType : "", listing.workflowStatus === "Draft" ? "Draft" : "", listing.listingStatus !== "Available" ? listing.listingStatus : ""].filter(Boolean),
    perSqm: listing.askingPrice && listing.pricePerSqm ? `${formatNaira(listing.pricePerSqm)} per m²${listing.converted ? ` · quoted ${quotedPrice(listing).split(" ")[0]}` : ""}` : "",
    diff,
    verdict: diff === null ? "" : Math.abs(diff) < 3 ? `Typical for ${place.name}` : `${Math.abs(diff)}% ${diff > 0 ? "above" : "below"} typical for ${place.name}`
  };
}

// "1.6 standard plots", "about half a standard plot".
function inPlots(sqm) {
  const plots = sqm / STANDARD_PLOT.sqm;
  if (plots < 0.4) return "under half a standard plot";
  if (plots < 0.75) return "about half a standard plot";
  if (plots < 1.15) return "about one standard plot";
  if (plots < 10) return `${(Math.round(plots * 10) / 10).toFixed(1).replace(/\.0$/, "")} standard plots`;
  return `${new Intl.NumberFormat("en-US").format(Math.round(plots))} standard plots`;
}

/* ---------- A plot as a drawing ---------- */
function PlotSheet({ listing, place, showArea }) {
  const { price, photo, placeholder, flags, perSqm, diff, verdict } = describe(listing, place);
  const where = [showArea ? listing.neighborhoodName : "", listing.estate && listing.estate !== listing.neighborhoodName ? listing.estate : "", listing.landUse].filter(Boolean).join(" · ");
  return (
    <Link className="fl-sheet" href={`/listings/${listing.id}`} prefetch={false}>
      <span className={`fl-sheet-top ${photo ? "has-photo" : ""}`}>
        {photo ? <img src={photo} alt="" loading="lazy" style={placeholder ? { objectPosition: placeholder.crop } : undefined} title={placeholder ? `Placeholder photo: ${placeholder.credit}` : undefined} /> : <PlotDrawing sqm={listing.sizeSqm} />}
        {photo && listing.sizeSqm ? <span className="fl-inset"><PlotDrawing sqm={listing.sizeSqm} compact /></span> : null}
        {placeholder ? <span className="fl-placeholder">Placeholder photo</span> : null}
        {listing.titleDocument ? <span className="fl-doc">{listing.titleDocument}</span> : null}
        {flags.length ? <span className="fl-flag">{flags[0]}</span> : null}
      </span>
      <span className="fl-sheet-body">
        <span className="fl-sheet-size">
          {listing.sizeSqm ? <><b>{formatSqm(listing.sizeSqm)} m²</b> · {inPlots(listing.sizeSqm)}</> : "Size not stated"}
        </span>
        <span className="fl-sheet-title">{listing.title}</span>
        {where ? <span className="fl-sheet-where">{where}</span> : null}
        <span className="fl-sheet-price">
          <b>{price.value || "Price on request"}</b>
          {perSqm ? <small>{perSqm}</small> : null}
        </span>
        {verdict ? (
          <span className="fl-fair">
            <Meter diff={diff} />
            <small className={diff < -2 ? "is-below" : ""}>{verdict}</small>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

// The plot and a standard plot on one scale, sharing a corner. Whichever is
// larger sets the scale, so a half plot sits inside the dashed outline and a
// hectare dwarfs it.
function PlotDrawing({ sqm, compact = false }) {
  const W = compact ? 120 : 300;
  const H = compact ? 72 : 170;
  const plot = plotOutline(sqm);
  if (!plot.sqm) {
    return (
      <svg className="fl-draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Size not stated">
        <text className="fl-draw-note" x={W / 2} y={H / 2 + 4} textAnchor="middle">Size not stated</text>
      </svg>
    );
  }
  const widest = Math.max(plot.depth, STANDARD_PLOT.depth);
  const tallest = Math.max(plot.frontage, STANDARD_PLOT.frontage);
  const pxPerM = compact ? Math.min((W - 20) / widest, (H - 20) / tallest) : Math.min((W - 80) / widest, (H - 62) / tallest);
  const round = (value) => Math.round(value * 10) / 10;
  const pw = round(plot.depth * pxPerM);
  const ph = round(plot.frontage * pxPerM);
  const sw = round(STANDARD_PLOT.depth * pxPerM);
  const sh = round(STANDARD_PLOT.frontage * pxPerM);
  const x0 = round((W - Math.max(pw, sw)) / 2);
  const y1 = compact ? round((H + Math.max(ph, sh)) / 2) : H - 34;
  const bar = [5, 10, 20, 50, 100, 200, 500, 1000].find((metres) => metres * pxPerM >= 34) || 1000;
  return (
    <svg className="fl-draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${formatSqm(plot.sqm)} square metres, ${inPlots(plot.sqm)}, drawn to scale`}>
      <rect className="fl-draw-fill" x={x0} y={round(y1 - ph)} width={pw} height={ph} />
      <rect className="fl-draw-std" x={x0} y={round(y1 - sh)} width={sw} height={sh} />
      <rect className="fl-draw-line" x={x0} y={round(y1 - ph)} width={pw} height={ph} pathLength="1" />
      {(compact ? [] : [[x0, y1 - ph], [x0 + pw, y1 - ph], [x0, y1], [x0 + pw, y1]]).map(([bx, by], index) => (
        <rect className="fl-draw-peg" key={index} x={round(bx - 2.5)} y={round(by - 2.5)} width="5" height="5" />
      ))}
      {compact ? null : (
        <g className="fl-draw-scale" transform={`translate(${x0} ${H - 14})`}>
          <path d={`M0 -3 V3 M0 0 H${round(bar * pxPerM)} M${round(bar * pxPerM)} -3 V3`} />
          <text x={round(bar * pxPerM + 6)} y="3.5">{bar >= 1000 ? "1 km" : `${bar} m`}</text>
        </g>
      )}
    </svg>
  );
}

// Where the price per m² sits in its area: the middle tick is the typical price,
// the ends a quarter and four times it.
function Meter({ diff }) {
  const at = Math.max(4, Math.min(96, ((Math.log(1 + diff / 100) / Math.log(4) + 1) / 2) * 100));
  return <i className="fl-meter" aria-hidden="true"><u style={{ left: `${Math.round(at)}%` }} className={diff < -2 ? "is-below" : ""} /></i>;
}

/* ---------- A plot as one line ---------- */
function PlotRow({ listing, place, showArea }) {
  const { price, photo, placeholder, flags, perSqm, diff, verdict } = describe(listing, place);
  const facts = [showArea ? listing.neighborhoodName : listing.estate, listing.sizeSqm ? `${formatSqm(listing.sizeSqm)} m²` : "", listing.landUse, listing.titleDocument].filter(Boolean);
  return (
    <Link className={`fl-row ${photo ? "has-photo" : ""}`} href={`/listings/${listing.id}`} prefetch={false}>
      {photo ? <img className="fl-row-photo" src={photo} alt="" loading="lazy" style={placeholder ? { objectPosition: placeholder.crop } : undefined} /> : null}
      <span className="fl-row-main">
        <span className="fl-row-title">{listing.title}</span>
        <span className="fl-row-facts">
          {flags.map((flag) => <em key={flag}>{flag}</em>)}
          {facts.join(" · ")}
        </span>
      </span>
      <span className="fl-row-price">
        <b>{price.value || "Price on request"}</b>
        {perSqm ? <small>{perSqm}</small> : null}
        {verdict ? <small className={diff < -2 ? "is-below" : ""}>{verdict}</small> : null}
      </span>
    </Link>
  );
}

/* ---------- The map: one circle per area, sized by how many plots are there ---------- */
function AreaMap({ areas, selected, onChoose }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const leafletRef = useRef(null);
  const framedRef = useRef(false);
  const chooseRef = useRef(onChoose);
  chooseRef.current = onChoose;
  const [ready, setReady] = useState(false);
  const most = Math.max(1, ...areas.map((item) => item.count));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !nodeRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(nodeRef.current, { zoomControl: false, scrollWheelZoom: false });
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
      framedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = areas.map((item) => {
      const size = Math.round(34 + 40 * Math.sqrt(item.count / most));
      const on = selected === item.id;
      const marker = L.marker(item.center, {
        title: `${item.name}: ${item.count} plots`,
        zIndexOffset: on ? 1000 : 0,
        icon: L.divIcon({
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `<div class="fl-pin ${on ? "is-on" : ""}" style="width:${size}px;height:${size}px">${item.count}<span>${item.name}</span></div>`
        })
      }).addTo(map);
      marker.on("click", () => chooseRef.current(item.id));
      return marker;
    });
  }, [areas, most, ready, selected]);

  // Frame the chosen area, or all of them. The first framing has nothing to
  // glide from, so it is set outright.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !areas.length) return;
    const chosen = areas.find((item) => item.id === selected);
    if (chosen && !framedRef.current) map.setView(chosen.center, 13);
    else if (chosen) map.flyTo(chosen.center, 13, { duration: 0.6 });
    else map.fitBounds(L.latLngBounds(areas.map((item) => item.center)), { padding: [50, 50], maxZoom: 13 });
    framedRef.current = true;
  }, [areas, ready, selected]);

  return <div className="fl-map-canvas" ref={nodeRef} />;
}

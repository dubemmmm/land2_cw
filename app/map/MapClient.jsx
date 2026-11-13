"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LocateFixed, Minus, Plus, Search } from "lucide-react";
import ConfidenceLegend from "@/components/ConfidenceLegend";
import { averageConfidence, confidenceLevel, confidencePattern, confidenceScore } from "@/lib/metrics";
import { areaPhoto, photoCredits } from "@/lib/photos";
import { formatNaira } from "@/lib/plot";

const NO_PRICES = {};
const HOME_VIEW = { center: [6.445, 3.445], zoom: 12 };
// Marker squares: area is proportional to price per m², between these sides (px).
const MIN_SIDE = 16;
const MAX_SIDE = 52;
const UNPRICED_SIDE = 12;

export default function MapClient({ initialNeighborhoods, prices = NO_PRICES }) {
  const [records, setRecords] = useState(initialNeighborhoods);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", jurisdiction: "Lagos" });
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerRef = useRef(null);
  const drawRef = useRef(null);
  const router = useRouter();

  const trackedRecords = useMemo(
    () => records.filter((n) => confidenceScore(n) >= 40).sort((a, b) => confidenceScore(b) - confidenceScore(a)),
    [records]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trackedRecords.filter((n) => {
      const score = confidenceScore(n);
      const level = confidenceLevel(score).toLowerCase();
      const matchesFilter = filter === "all" || level === filter;
      const matchesQuery = !q || `${n.name} ${n.jurisdiction}`.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [trackedRecords, query, filter]);

  const maxPrice = useMemo(
    () => trackedRecords.reduce((max, n) => Math.max(max, Number(prices[n.id]) || 0), 0),
    [trackedRecords, prices]
  );

  // The selection follows the visible list: if the chosen location is filtered
  // out, the first visible one takes its place.
  const selected = filtered.find((n) => n.id === selectedId) || filtered[0] || null;
  const selectedKey = selected?.id ?? null;
  const showsPhoto = trackedRecords.some((n) => areaPhoto(n.id));

  // Keep the draw function current, and redraw whenever its inputs change.
  useEffect(() => {
    drawRef.current = (L) => {
      if (!layerRef.current) return;
      drawLocations(L, layerRef.current, filtered, {
        prices,
        maxPrice,
        selectedId: selectedKey,
        onSelect: setSelectedId
      });
    };
    let cancelled = false;
    async function redraw() {
      if (!mapInstance.current || !layerRef.current) return;
      const L = await import("leaflet");
      if (!cancelled && mapInstance.current && drawRef.current) drawRef.current(L);
    }
    redraw();
    return () => {
      cancelled = true;
    };
  }, [filtered, prices, maxPrice, selectedKey]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (cancelled || !mapRef.current || mapInstance.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: true }).setView(HOME_VIEW.center, HOME_VIEW.zoom);
      mapInstance.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      if (drawRef.current) drawRef.current(L);
      setTimeout(() => {
        if (mapInstance.current === map) map.invalidateSize();
      }, 200);
    }
    init();
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  async function createLocation(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const res = await fetch("/api/neighborhoods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const record = await res.json();
    if (!res.ok) return;
    setRecords((current) => current.concat(record));
    setCreating(false);
    setForm({ name: "", jurisdiction: "Lagos" });
    router.push(`/locations/${record.id}`);
  }

  function zoom(delta) {
    if (!mapInstance.current) return;
    delta > 0 ? mapInstance.current.zoomIn() : mapInstance.current.zoomOut();
  }

  function recenter() {
    if (!mapInstance.current) return;
    mapInstance.current.setView(HOME_VIEW.center, HOME_VIEW.zoom);
  }

  function selectFromList(n) {
    setSelectedId(n.id);
    const center = centerOf(n);
    if (center && mapInstance.current) mapInstance.current.panTo(center);
  }

  const selectedScore = selected ? confidenceScore(selected) : 0;
  const selectedPhoto = selected ? areaPhoto(selected.id, 960) : null;
  const selectedPrice = selected ? Number(prices[selected.id]) || 0 : 0;

  return (
    <div className="map-shell">
      <header className="map-head">
        <h1 className="cw-h2">Lagos land map</h1>
        <p>
          {trackedRecords.length} {trackedRecords.length === 1 ? "location" : "locations"} tracked, with an average data
          confidence of {averageConfidence(trackedRecords)} out of 100.
        </p>
      </header>

      <div className="map-stage">
        <div className="map-canvas" ref={mapRef} />

        <div className="map-key">
          <p>Square size shows price per m². Fill shows data confidence.</p>
          <ConfidenceLegend />
        </div>

        <div className="map-controls">
          <button className="cw-icon-btn" type="button" onClick={() => zoom(1)} aria-label="Zoom in"><Plus size={18} /></button>
          <button className="cw-icon-btn" type="button" onClick={() => zoom(-1)} aria-label="Zoom out"><Minus size={18} /></button>
          <button className="cw-icon-btn" type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={17} /></button>
        </div>
      </div>

      <aside className="map-panel" aria-label="Locations">
        <div className="map-panel-controls">
          <label className="map-search">
            <Search size={16} aria-hidden="true" />
            <input
              className="cw-input"
              placeholder="Search neighborhoods"
              aria-label="Search neighborhoods"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="cw-tabs map-filter-tabs" role="group" aria-label="Filter by confidence">
            {["all", "high", "medium"].map((item) => (
              <button
                className={filter === item ? "active" : ""}
                type="button"
                key={item}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="map-panel-scroll">
          {selected && (
            <section className="map-selected" aria-live="polite">
              {selectedPhoto && (
                <figure className="map-selected-photo">
                  <img src={selectedPhoto.src} alt={`Area view of ${selectedPhoto.place}`} loading="lazy" />
                  <figcaption>Area view · {selectedPhoto.place}</figcaption>
                </figure>
              )}
              <h2>{selected.name}</h2>
              <p className="map-selected-place">{selected.jurisdiction}</p>
              <dl className="map-selected-facts">
                <div>
                  <dt>Price per m²</dt>
                  <dd className="sq-fig">{selectedPrice ? formatNaira(selectedPrice) : "Not priced yet"}</dd>
                </div>
                <div>
                  <dt>Data confidence</dt>
                  <dd className="sq-fig">
                    <i className={`sq-pat sq-pat-${confidencePattern(selectedScore)}`} aria-hidden="true" />
                    {confidenceLevel(selectedScore)} · {selectedScore}
                  </dd>
                </div>
              </dl>
              <Link className="cw-link" href={`/locations/${selected.id}`}>
                Open the {selected.name} page
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </section>
          )}

          <div className="map-location-list">
            {filtered.map((n) => {
              const score = confidenceScore(n);
              const level = confidenceLevel(score);
              const price = Number(prices[n.id]) || 0;
              const isSelected = selected?.id === n.id;
              return (
                <button
                  className={`map-location-row${isSelected ? " active" : ""}`}
                  type="button"
                  key={n.id}
                  aria-pressed={isSelected}
                  onClick={() => selectFromList(n)}
                >
                  <i className={`sq-pat sq-pat-${confidencePattern(score)}`} aria-hidden="true" />
                  <span className="map-location-text">
                    <strong>{n.name}</strong>
                    <span>{n.jurisdiction} · {level} {score}</span>
                  </span>
                  <span className="map-location-price sq-fig">{price ? `${formatNaira(price)}/m²` : "—"}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="map-location-empty">No neighborhoods match this search.</p>}
          </div>

          {showsPhoto && (
            <p className="sq-photo-credit map-photo-credit">
              Area views are stand-in photos from Wikimedia Commons. {photoCredits}
            </p>
          )}
        </div>

        <footer className="map-panel-foot">
          {creating ? (
            <form className="map-create-form" onSubmit={createLocation}>
              <label className="cw-field">Neighborhood name<input className="cw-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
              <label className="cw-field">Jurisdiction<input className="cw-input" value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></label>
              <div className="map-create-actions">
                <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit">Create</button>
                <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <span>Add a neighborhood to track</span>
              <button className="cw-btn cw-btn-navy cw-btn-sm" type="button" onClick={() => setCreating(true)} aria-label="Add neighborhood">
                <Plus size={16} />
                Add
              </button>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

function centerOf(n) {
  const center = n.geometry?.center;
  if (Array.isArray(center) && center.length >= 2) return [Number(center[0]), Number(center[1])];
  const polygon = n.geometry?.polygon;
  if (!Array.isArray(polygon) || polygon.length === 0) return null;
  const sum = polygon.reduce((acc, point) => [acc[0] + Number(point[0]), acc[1] + Number(point[1])], [0, 0]);
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

function squareSide(price, maxPrice) {
  if (!price || !maxPrice) return UNPRICED_SIDE;
  return Math.round(Math.max(MIN_SIDE, Math.min(MAX_SIDE, Math.sqrt(price / maxPrice) * MAX_SIDE)));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

// One outline and one square per location. Colours and fills come from
// map.css (.map-area, .map-sq-*), so nothing is hardcoded here.
function drawLocations(L, group, records, { prices, maxPrice, selectedId, onSelect }) {
  group.clearLayers();
  records.forEach((n) => {
    const score = confidenceScore(n);
    const price = Number(prices[n.id]) || 0;
    const isSelected = n.id === selectedId;
    const select = () => onSelect(n.id);

    const outline = n.geometry?.polygon;
    if (Array.isArray(outline) && outline.length > 2) {
      L.polygon(outline, { className: `map-area${isSelected ? " is-selected" : ""}`, weight: 1.2 })
        .on("click", select)
        .addTo(group);
    }

    const center = centerOf(n);
    if (!center) return;
    const side = squareSide(price, maxPrice);
    const icon = L.divIcon({
      className: `map-sq-icon${isSelected ? " is-selected" : ""}`,
      html: `<span class="map-sq map-sq-${confidencePattern(score)}"></span>`,
      iconSize: [side, side],
      iconAnchor: [side / 2, side / 2]
    });
    const figure = price ? `${formatNaira(price)}/m²` : String(score);

    L.marker(center, {
      icon,
      title: `${n.name}: ${confidenceLevel(score)} confidence`,
      keyboard: true,
      riseOnHover: true,
      // Smaller squares sit above larger ones so none is hidden.
      zIndexOffset: isSelected ? 2000 : 1000 - side * 10
    })
      .bindTooltip(`<strong>${escapeHtml(n.name)}</strong>&nbsp;&nbsp;<span>${escapeHtml(figure)}</span>`, {
        permanent: true,
        interactive: true,
        direction: "bottom",
        offset: [0, side / 2],
        className: `map-label${isSelected ? " is-selected" : ""}`
      })
      .on("click", select)
      .addTo(group);
  });
}

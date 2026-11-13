// Pure geometry and formatting helpers for the drawings. Safe on server and client.

// The conventional Lagos residential plot: 18 m frontage by 36 m depth.
export const STANDARD_PLOT = { frontage: 18, depth: 36, sqm: 648 };

// Listings store an SVG data-URI when no real photo was uploaded.
export function isPlaceholderPhoto(src) {
  const value = String(src || "");
  return !value || (value.startsWith("data:image/svg+xml") && /placeholder/i.test(value));
}

export function realPhoto(photos) {
  return (photos || []).find((src) => !isPlaceholderPhoto(src)) || null;
}

// Actual plot dimensions are not recorded, so the outline is indicative:
// a 1:2 rectangle with the recorded area. Only the area is to scale.
export function plotOutline(sqm) {
  const area = Math.max(0, Number(sqm) || 0);
  const frontage = Math.sqrt(area / 2);
  return { frontage, depth: frontage * 2, sqm: area };
}

export function formatSqm(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

export function formatNaira(value) {
  const n = Number(value) || 0;
  if (!n) return "—";
  if (n >= 1e9) return `₦${trim(n / 1e9, 2)}B`;
  if (n >= 1e6) return `₦${trim(n / 1e6, n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `₦${Math.round(n / 1e3)}K`;
  return `₦${Math.round(n)}`;
}

function trim(value, digits) {
  return Number(value.toFixed(digits));
}

// Cartogram: one square per location, area proportional to price per m²,
// placed by its coordinates, then nudged apart until nothing overlaps.
export function layoutCartogram(items, { width = 250, height = 170, maxSide = 150, gap = 30 } = {}) {
  const priced = items.filter((item) => Number(item.priceValue) > 0);
  if (!priced.length) return { squares: [], width, height };
  const maxPrice = Math.max(...priced.map((item) => item.priceValue));
  const lats = priced.map((item) => item.lat).filter(Number.isFinite);
  const lngs = priced.map((item) => item.lng).filter(Number.isFinite);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];

  const squares = priced.map((item, index) => {
    const side = Math.sqrt(item.priceValue / maxPrice) * maxSide;
    const hasPoint = Number.isFinite(item.lat) && Number.isFinite(item.lng);
    const fx = hasPoint && maxLng > minLng ? (item.lng - minLng) / (maxLng - minLng) : (index % 3) / 2;
    const fy = hasPoint && maxLat > minLat ? (maxLat - item.lat) / (maxLat - minLat) : Math.floor(index / 3) / 2;
    return { ...item, side, cx: fx * width, cy: fy * height };
  });

  for (let pass = 0; pass < 400; pass += 1) {
    let moved = false;
    for (let i = 0; i < squares.length; i += 1) {
      for (let j = i + 1; j < squares.length; j += 1) {
        const a = squares[i];
        const b = squares[j];
        const reach = (a.side + b.side) / 2 + gap;
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const overlapX = reach - Math.abs(dx);
        const overlapY = reach - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        if (overlapX < overlapY) {
          const push = (overlapX / 2) * (dx >= 0 ? 1 : -1);
          a.cx -= push;
          b.cx += push;
        } else {
          const push = (overlapY / 2) * (dy >= 0 ? 1 : -1);
          a.cy -= push;
          b.cy += push;
        }
      }
    }
    if (!moved) break;
  }

  const pad = 26;
  const left = Math.min(...squares.map((s) => s.cx - s.side / 2)) - pad;
  const top = Math.min(...squares.map((s) => s.cy - s.side / 2)) - pad;
  const right = Math.max(...squares.map((s) => s.cx + s.side / 2)) + pad;
  const bottom = Math.max(...squares.map((s) => s.cy + s.side / 2)) + pad;
  return {
    width: Math.round(right - left),
    height: Math.round(bottom - top),
    squares: squares.map((s) => ({
      ...s,
      x: round(s.cx - s.side / 2 - left),
      y: round(s.cy - s.side / 2 - top),
      side: round(s.side)
    }))
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

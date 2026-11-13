import Link from "next/link";
import { MapPin } from "lucide-react";
import PlotGlyph from "@/components/PlotGlyph";
import { areaPhoto } from "@/lib/photos";
import { formatNaira, formatSqm, realPhoto } from "@/lib/plot";

// A listing as a sheet: photo (the listing's own, else an area view) with the
// plot drawn to scale in an inset, then the figures.
export default function PlotCard({ listing, scaleSqm, href, badge }) {
  const own = realPhoto(listing.photos);
  const area = own ? null : areaPhoto(listing.neighborhoodId);
  const perSqm = listing.sizeSqm && listing.askingPrice ? listing.askingPrice / listing.sizeSqm : 0;
  const status = String(listing.listingStatus || "").toLowerCase().replace(/\s+/g, "-");
  const content = (
    <>
      <div className={`sq-plotcard-drawing sq-grid ${own || area ? "has-photo" : ""}`}>
        {own ? <img className="sq-plotcard-photo" src={own} alt="" loading="lazy" /> : null}
        {area ? <img className="sq-plotcard-photo" src={area.src} alt="" loading="lazy" title={`Photo: ${area.credit}, ${area.license}`} /> : null}
        {own || area ? (
          <div className="sq-plotcard-inset"><PlotGlyph sqm={listing.sizeSqm} scaleSqm={scaleSqm} /></div>
        ) : (
          <PlotGlyph sqm={listing.sizeSqm} scaleSqm={scaleSqm} />
        )}
        <span className={`listing-status ${status}`}>{listing.listingStatus}</span>
        {listing.titleDocument ? <span className="sq-stamp">{listing.titleDocument}</span> : null}
        {area ? <span className="sq-plotcard-cap">Area view · {area.place}</span> : null}
        {badge}
      </div>
      <div className="sq-plotcard-body">
        <h3>{listing.title}</h3>
        <p><MapPin size={13} aria-hidden="true" />{listing.neighborhoodName}{listing.estate ? ` · ${listing.estate}` : ""} · {listing.landUse}</p>
        <dl>
          <div><dt>Area</dt><dd className="sq-fig">{formatSqm(listing.sizeSqm)} m²</dd></div>
          <div><dt>Per m²</dt><dd className="sq-fig">{formatNaira(perSqm)}</dd></div>
          <div><dt>Asking</dt><dd className="sq-fig">{listing.askingPrice ? formatNaira(listing.askingPrice) : "Not set"}</dd></div>
        </dl>
      </div>
    </>
  );
  return href
    ? <Link className="sq-sheet sq-plotcard" href={href}>{content}</Link>
    : <article className="sq-sheet sq-plotcard">{content}</article>;
}

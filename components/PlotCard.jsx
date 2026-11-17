import Link from "next/link";
import { MapPin } from "lucide-react";
import { areaPhoto, photo } from "@/lib/photos";
import { formatNaira, formatSqm, headlinePrice, realPhoto } from "@/lib/plot";

// A listing card: photo (the listing's own, else an area view), then the figures.
// `note` is one line under the figures, e.g. how the price sits against the area median.
export default function PlotCard({ listing, href = `/listings/${listing.id}`, badge, note }) {
  const own = realPhoto(listing.photos);
  const area = own ? null : areaPhoto(listing.neighborhoodId) || photo("skyline");
  const price = headlinePrice(listing);
  // Nearly every plot is an available sale, so only the exceptions are flagged.
  const flag = listing.listingStatus && listing.listingStatus !== "Available"
    ? listing.listingStatus
    : listing.offerType && listing.offerType !== "Sale" ? listing.offerType : "";
  const content = (
    <>
      <div className="sq-plotcard-drawing has-photo">
        {own ? <img className="sq-plotcard-photo" src={own} alt="" loading="lazy" /> : null}
        {area ? <img className="sq-plotcard-photo" src={area.src} alt="" loading="lazy" title={`Photo: ${area.credit}, ${area.license}`} /> : null}
        {flag ? <span className={`listing-status ${flag.toLowerCase().replace(/\s+/g, "-")}`}>{flag}</span> : null}
        {listing.titleDocument ? <span className="sq-stamp">{listing.titleDocument}</span> : null}
        {area ? <span className="sq-plotcard-cap">Area view · {area.place}</span> : null}
        {badge}
      </div>
      <div className="sq-plotcard-body">
        <h3>{listing.title}</h3>
        <p><MapPin size={13} aria-hidden="true" />{[listing.neighborhoodName, listing.estate, listing.landUse].filter(Boolean).join(" · ")}</p>
        <dl>
          <div><dt>Area</dt><dd className="sq-fig">{listing.sizeSqm ? `${formatSqm(listing.sizeSqm)} m²` : "—"}</dd></div>
          <div><dt>Per m²</dt><dd className="sq-fig">{formatNaira(listing.pricePerSqm)}</dd></div>
          <div><dt>{price.label}</dt><dd className="sq-fig">{price.value || "—"}</dd></div>
        </dl>
        {note ? <p className="sq-plotcard-note">{note}</p> : null}
      </div>
    </>
  );
  return href
    // No prefetch: a page of cards would otherwise render two dozen listing pages on the server.
    ? <Link className="sq-sheet sq-plotcard" href={href} prefetch={false}>{content}</Link>
    : <article className="sq-sheet sq-plotcard">{content}</article>;
}

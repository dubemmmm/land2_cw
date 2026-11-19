// Every detail a listing has, described once: its name in plain words, what
// kind of value it holds and how to save a new value. The listings desk builds
// its columns, its filters and its edit form from this list, and fields staff
// add themselves are described the same way. No database access: safe in the browser.

export const TITLE_DOCUMENTS = ["C of O", "Governor's Consent", "Excision", "Gazette", "Deed of Assignment", "Registered Survey"];
export const LISTING_STATUSES = ["Available", "Under offer", "Sold", "Off-market", "Coming soon"];
export const LAND_USES = ["Residential", "Commercial", "Mixed-use", "Industrial"];
export const OFFER_TYPES = ["Sale", "Joint venture", "Lease"];
export const PRICE_BASES = [
  ["total", "The whole plot"],
  ["per_sqm", "Each m²"],
  ["lease", "A year's rent"],
  ["lease_per_sqm", "A year's rent per m²"],
  ["unknown", "Not settled"]
];
export const SIZE_UNITS = [["sqm", "m²"], ["ha", "hectares"], ["acres", "acres"]];
export const MAX_PHOTOS = 20;

// The kinds of field staff can add.
export const CUSTOM_TYPES = [
  ["text", "Text", "A few words, such as a survey plan number"],
  ["number", "Number", "A figure, such as the number of plots"],
  ["yesno", "Yes or no", "Such as whether the land is fenced"],
  ["choice", "One of a list", "Pick from choices you write, such as road type"],
  ["date", "Date", "Such as when the plot was inspected"]
];

const pairs = (values, blank) => [...(blank ? [["", blank]] : []), ...values.map((value) => [value, value])];

// group: the section of the edit form. width: column width in the table, px.
const BUILT_IN = [
  { key: "title", label: "Title", type: "text", group: "Basics", width: 320, required: true },
  { key: "published", label: "Public", type: "public", group: "Visibility", width: 96 },
  { key: "neighborhoodId", label: "Area", type: "choice", group: "Basics", width: 170, required: true },
  { key: "estate", label: "Estate or neighbourhood", type: "text", group: "Basics", width: 190 },
  { key: "address", label: "Address", type: "text", group: "Basics", width: 220 },
  { key: "sizeSqm", label: "Size, m²", type: "number", group: "Size and title", width: 110 },
  { key: "priceAmount", label: "Price as quoted", type: "number", group: "Price", width: 150 },
  { key: "priceCurrency", label: "Currency", type: "choice", group: "Price", width: 110, options: [["NGN", "Naira (₦)"], ["USD", "US dollars ($)"]] },
  { key: "priceBasis", label: "The price is for", type: "choice", group: "Price", width: 170, options: PRICE_BASES },
  { key: "offerType", label: "Offer", type: "choice", group: "Price", width: 140, options: pairs(OFFER_TYPES) },
  { key: "landUse", label: "Land use", type: "choice", group: "Size and title", width: 150, options: pairs(LAND_USES, "Not stated") },
  { key: "titleDocument", label: "Title document", type: "choice", group: "Size and title", width: 190, options: pairs(TITLE_DOCUMENTS, "Not stated") },
  { key: "listingStatus", label: "Status", type: "choice", group: "Visibility", width: 140, options: pairs(LISTING_STATUSES) },
  { key: "agentName", label: "Agent's name", type: "text", group: "Agent", width: 170 },
  { key: "agentPhone", label: "Agent's phone", type: "text", group: "Agent", width: 160 },
  { key: "description", label: "Description", type: "longtext", group: "Description", width: 300 },
  { key: "photos", label: "Photos", type: "photos", group: "Photos", width: 96 },
  // Worked out or recorded by the system; shown, never typed.
  { key: "askingPrice", label: "Buyers see", type: "money", readOnly: true, width: 130 },
  { key: "pricePerSqm", label: "Per m²", type: "money", readOnly: true, width: 120 },
  { key: "sourceId", label: "Reference", type: "text", readOnly: true, width: 120 },
  { key: "listedAt", label: "Listed on", type: "date", readOnly: true, width: 120 },
  { key: "updatedAt", label: "Last changed", type: "date", readOnly: true, width: 130 }
];

export const DEFAULT_COLUMNS = ["title", "published", "neighborhoodId", "sizeSqm", "priceAmount", "priceBasis", "askingPrice", "titleDocument", "listingStatus", "photos"];

// The full catalogue: built-in fields with the area choices filled in, then the
// fields staff have added (archived ones left out unless asked for).
export function fieldCatalogue(customFields = [], neighborhoods = [], { includeArchived = false } = {}) {
  const areas = neighborhoods.map((item) => [item.id, item.name]);
  return [
    ...BUILT_IN.map((field) => (field.key === "neighborhoodId" ? { ...field, options: areas } : field)),
    ...customFields
      .filter((field) => includeArchived || !field.archived)
      .map((field) => ({
        key: `custom.${field.id}`,
        customId: field.id,
        label: field.label,
        type: field.type,
        group: "More details",
        width: field.type === "text" ? 190 : 150,
        options: field.type === "choice" ? pairs(field.options, "Not set") : undefined,
        showToBuyers: field.showToBuyers,
        archived: field.archived
      }))
  ];
}

export function fieldValue(listing, field) {
  if (field.customId) return listing.custom?.[field.customId] ?? null;
  if (field.key === "photos") return listing.photos || [];
  return listing[field.key];
}

// What to send to the server to store `value` in `field`.
export function patchFor(field, value) {
  if (field.customId) return { custom: { [field.customId]: value } };
  if (field.key === "published") return { workflowStatus: value ? "Published" : "Draft" };
  if (field.key === "sizeSqm") return { sizeValue: Number(value) || 0, sizeUnit: "sqm" };
  if (field.type === "number") return { [field.key]: Number(value) || 0 };
  return { [field.key]: value };
}

export function optionLabel(field, value) {
  const match = (field.options || []).find(([key]) => key === value);
  return match ? match[1] : value || "";
}

// A value as words, for table cells, filters and the history list.
export function formatValue(field, value) {
  if (field.type === "public") return value ? "Public" : "Hidden";
  if (field.type === "yesno") return value === true ? "Yes" : value === false ? "No" : "";
  if (field.type === "choice") return optionLabel(field, value ?? "");
  if (field.type === "photos") return `${(value || []).length}`;
  if (field.type === "date") return value ? String(value).slice(0, 10) : "";
  if (field.type === "number" || field.type === "money") return value || value === 0 ? new Intl.NumberFormat("en-US").format(Number(value) || 0) : "";
  return value == null ? "" : String(value);
}

// What still needs a person to look at it. Photos are worth adding but are not an error.
export function listingGaps(listing) {
  const missing = [];
  if (listing.priceBasis === "unknown") missing.push("what the price is for");
  if (!listing.priceAmount) missing.push("price");
  if (!listing.sizeSqm) missing.push("size");
  if (!listing.titleDocument) missing.push("title document");
  return missing;
}

/* ---------- Checking values of staff-added fields before they are stored ---------- */

// One value, made to fit its field's type. null means "not set".
export function cleanCustomValue(field, value) {
  if (value === null || value === undefined || value === "") return null;
  if (field.type === "number") {
    const number = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(number) ? number : null;
  }
  if (field.type === "yesno") return value === true || value === "true" || value === "Yes" ? true : value === false || value === "false" || value === "No" ? false : null;
  if (field.type === "choice") return field.options.includes(String(value)) ? String(value) : null;
  if (field.type === "date") return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null;
  return String(value).trim().slice(0, 500) || null;
}

// A listing's custom values with unknown fields and empty values dropped.
// Values of archived fields are kept, so bringing a field back brings its values back.
export function cleanCustom(values, customFields) {
  const cleaned = {};
  for (const field of customFields) {
    const value = cleanCustomValue(field, values?.[field.id]);
    if (value !== null) cleaned[field.id] = value;
  }
  return cleaned;
}

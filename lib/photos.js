// Stand-in photography, hot-linked from Wikimedia Commons (CC BY-SA).
// These are area views, not photos of any listed plot. Replace with CW's own
// photography before launch; the credit line must stay while these are used.
const commons = (path, width) => {
  const file = path.split("/").pop();
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${width}px-${file}`;
};

const sources = {
  ikoyi: { path: "d/d0/Ikoyi%2C_Lagos%2C_Nigeria.jpg", place: "Ikoyi", credit: "Reginald Bassey", license: "CC BY-SA 4.0" },
  victoriaIsland: { path: "7/72/Aerial_view_of_victoria_island_in_Lagos%2C_Nigeria_with_habours_for_yatches.jpg", place: "Victoria Island", credit: "Ayorinde Ogundele", license: "CC BY-SA 4.0" },
  linkBridge: { path: "7/74/Lekki_Ikoyi_Link_Bridge.jpg", place: "Lekki–Ikoyi Link Bridge", credit: "Chippla", license: "CC BY-SA 3.0" },
  farmland: { path: "a/a7/Aerial_view_of_a_framland_in_the_outskirt_of_Lagos%2C_Nigeria.jpg", place: "Outskirts of Lagos", credit: "Ayorinde Ogundele", license: "CC BY-SA 4.0" }
};

export function photo(key, width = 960) {
  const source = sources[key];
  return source ? { ...source, src: commons(source.path, width) } : null;
}

// Which area view stands in for each neighbourhood.
const byNeighborhood = {
  ikoyi: "ikoyi",
  "banana-island": "ikoyi",
  "victoria-island": "victoriaIsland",
  oniru: "victoriaIsland",
  "eko-atlantic": "victoriaIsland",
  "lekki-phase-1": "linkBridge"
};

export function areaPhoto(neighborhoodId, width = 960) {
  return photo(byNeighborhood[neighborhoodId], width);
}

export const photoCredits = Object.values(sources)
  .map((source) => `${source.place}: ${source.credit}, ${source.license}`)
  .join(" · ");

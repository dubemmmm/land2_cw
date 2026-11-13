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
  lekki: { path: "a/a7/Areal_view_of_Lekki_phase_1%2C_Lagos%2C_Nigeria.jpg", place: "Lekki Phase 1", credit: "Madewun", license: "CC BY-SA 4.0" },
  skyline: { path: "1/12/Lagos_skyline.jpg", place: "Lagos skyline", credit: "Clara Sanchiz", license: "CC BY-SA 2.0" },
  bridgeNight: { path: "c/c7/Night-view-of-lekki-link-bridge.jpg", place: "Lekki–Ikoyi Link Bridge at night", credit: "S.aderogba", license: "CC BY-SA 4.0" },
  bananaIsland: { path: "8/8a/Banana_Island_Lagos.jpg", place: "Banana Island", credit: "Chippla", license: "CC BY-SA 3.0" },
  farmland: { path: "a/a7/Aerial_view_of_a_framland_in_the_outskirt_of_Lagos%2C_Nigeria.jpg", place: "Outskirts of Lagos", credit: "Ayorinde Ogundele", license: "CC BY-SA 4.0" }
};

export function photo(key, width = 960) {
  const source = sources[key];
  return source ? { ...source, src: commons(source.path, width) } : null;
}

// Which area view stands in for each neighbourhood.
const byNeighborhood = {
  ikoyi: "ikoyi",
  "banana-island": "bananaIsland",
  "victoria-island": "victoriaIsland",
  oniru: "victoriaIsland",
  "eko-atlantic": "victoriaIsland",
  "lekki-phase-1": "lekki"
};

export function areaPhoto(neighborhoodId, width = 960) {
  return photo(byNeighborhood[neighborhoodId], width);
}

export const photoCredits = Object.values(sources)
  .map((source) => `${source.place}: ${source.credit}, ${source.license}`)
  .join(" · ");

// Browser side of listing photo upload: each photo is shrunk here, sent
// straight to photo storage, and the listing keeps only its address.

const MAX_PHOTO_SIDE = 1920;

export async function uploadPhoto(file) {
  const blob = await shrink(file);
  const ticket = await fetch("/api/uploads/listing-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: blob.type })
  });
  const { uploadUrl, url, error } = await ticket.json().catch(() => ({}));
  if (!ticket.ok) throw new Error(error || "the upload was refused");
  const sent = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
  if (!sent.ok) throw new Error("photo storage did not accept it");
  return url;
}

// Draws the photo no larger than MAX_PHOTO_SIDE on its longer side and saves
// it as JPEG, so a 10MB phone picture goes up as a few hundred KB.
async function shrink(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new Error("it is not a readable image");
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("it could not be prepared for upload");
  return blob;
}

"use client";

// Crop math and drawing for profile photos. A crop is a zoom and an offset: zoom 1 fits the whole
// photo inside the square (nothing cut off), higher zooms fill it and then go closer. The offset is
// in fractions of the square's side, so the same crop draws the small preview and the saved file.

export interface Crop {
  zoom: number; // 1 = whole photo fits; FILL zoom = it covers the square
  x: number; // offset of the photo's center from the square's center, as a fraction of the side
  y: number;
}

export const MAX_ZOOM_OVER_FILL = 3; // up to 3× closer than "fill"
export const OUTPUT_SIZE = 768; // sharp in the portfolio's large circle on high-density screens
const WHOLE_MAX_SIDE = 1400; // a whole photo keeps its shape; its long side is scaled to at most this

export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Opens an image file for cropping, or throws a friendly error if it isn't one we can read. Any
 * format the browser can open works (Safari opens iPhone HEIC photos); the saved file is WebP/JPEG.
 */
export async function loadPhoto(file: File): Promise<ImageBitmap> {
  if (file.type && !file.type.startsWith("image/")) throw new Error("That file isn't a photo.");
  return createImageBitmap(file).catch(() => {
    throw new Error("Your browser can't open that photo. Try a JPEG or PNG.");
  });
}

/** The zoom at which the photo just covers the square (no empty space). */
export const fillZoom = (photo: ImageBitmap) => Math.max(photo.width, photo.height) / Math.min(photo.width, photo.height);

/** Keeps the photo from being dragged away: it may move only as far as its size allows. */
export function clampCrop(photo: ImageBitmap, crop: Crop): Crop {
  const zoom = Math.min(Math.max(crop.zoom, 1), fillZoom(photo) * MAX_ZOOM_OVER_FILL);
  const fit = 1 / Math.max(photo.width, photo.height);
  const w = photo.width * fit * zoom; // drawn size, as a fraction of the square
  const h = photo.height * fit * zoom;
  const limit = (drawn: number) => Math.abs(drawn - 1) / 2;
  const clamp = (v: number, l: number) => Math.min(Math.max(v, -l), l);
  return { zoom, x: clamp(crop.x, limit(w)), y: clamp(crop.y, limit(h)) };
}

/** Draws the crop into a square canvas. Space around a fitted photo gets a soft, blurred copy of it. */
export function drawCrop(canvas: HTMLCanvasElement, photo: ImageBitmap, crop: Crop, size: number) {
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingQuality = "high";

  const cover = size / Math.min(photo.width, photo.height);
  ctx.save();
  ctx.filter = `blur(${Math.round(size / 18)}px) saturate(1.1)`;
  ctx.drawImage(photo, (size - photo.width * cover * 1.15) / 2, (size - photo.height * cover * 1.15) / 2, photo.width * cover * 1.15, photo.height * cover * 1.15);
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 0, size, size);

  const scale = (size / Math.max(photo.width, photo.height)) * crop.zoom;
  const w = photo.width * scale;
  const h = photo.height * scale;
  ctx.drawImage(photo, (size - w) / 2 + crop.x * size, (size - h) / 2 + crop.y * size, w, h);
}

// WebP, or JPEG where the browser can't make WebP.
async function encode(canvas: HTMLCanvasElement): Promise<PreparedPhoto> {
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
  const webp = await toBlob("image/webp");
  const blob = webp && webp.type === "image/webp" ? webp : await toBlob("image/jpeg");
  if (!blob) throw new Error("Your browser couldn't prepare the photo. Please try another browser.");
  return { blob, width: canvas.width, height: canvas.height };
}

/** The photo cropped to a square for the circle, ready to upload. */
export function exportCrop(photo: ImageBitmap, crop: Crop): Promise<PreparedPhoto> {
  const canvas = document.createElement("canvas");
  drawCrop(canvas, photo, crop, OUTPUT_SIZE);
  return encode(canvas);
}

/** The whole photo at its own shape (nothing cut off), scaled down if it's very large. */
export function exportWhole(photo: ImageBitmap): Promise<PreparedPhoto> {
  const scale = Math.min(1, WHOLE_MAX_SIDE / Math.max(photo.width, photo.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(photo.width * scale);
  canvas.height = Math.round(photo.height * scale);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
  }
  return encode(canvas);
}

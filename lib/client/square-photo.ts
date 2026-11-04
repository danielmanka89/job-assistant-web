"use client";

/**
 * Crops an image file to a centered square and scales it to `size` px, as WebP (JPEG where WebP
 * isn't supported), so uploads stay small (~50–150 KB) whatever the camera produced.
 */
export async function squarePhoto(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file isn't an image we can read. Use a JPEG, PNG or WebP photo.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't prepare the photo. Please try another browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  const webp = await encode("image/webp");
  const blob = webp && webp.type === "image/webp" ? webp : await encode("image/jpeg");
  if (!blob) throw new Error("Your browser couldn't prepare the photo. Please try another browser.");
  return blob;
}

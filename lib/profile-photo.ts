// Profile photos: what can be uploaded and how it's linked.

export const MAX_PHOTO_BYTES = 1_500_000; // the browser crops and compresses to ~100 KB first

/** The image type from the file's first bytes (not its name or the browser's claim), or null. */
export function photoType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** The photo's address; the version changes on every upload, so browsers never show an old one. */
export const photoUrl = (userId: string, savedAt: Date) => `/api/profile/photo/${userId}?v=${savedAt.getTime()}`;

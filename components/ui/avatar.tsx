import Image from "next/image";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** The user's photo in a circle, or their initials on the theme color when there's no photo. */
export function Avatar({ name, photoUrl, className = "size-12 text-lg" }: { name: string; photoUrl?: string | null; className?: string }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display font-semibold text-white shadow-md shadow-brand-600/25 ${className}`}
    >
      {photoUrl ? (
        // unoptimized: the photo is already a small square served by our own API.
        <Image src={photoUrl} alt="" fill unoptimized sizes="96px" className="object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

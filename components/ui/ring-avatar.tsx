import Image from "next/image";
import type { RingStyle } from "@/lib/types";

/**
 * A person's picture in the glowing ring they picked (Settings > Profile ring). With no photo it shows
 * a plain silhouette, never initials. Away (online false) dims the ring and drops its glow; leave
 * `online` out where presence doesn't matter.
 */
export function RingAvatar({
  name,
  photoUrl,
  ring = "PRISM",
  online,
  className = "size-11",
}: {
  name: string;
  photoUrl?: string | null;
  ring?: RingStyle;
  online?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`ring-avatar ${className}`}
      data-ring={ring}
      data-online={online === undefined ? undefined : String(online)}
      title={online === undefined ? undefined : `${name} · ${online ? "ON, in the app" : "OFF, away"}`}
    >
      <span className="ring-avatar-ring">
        <span className="relative grid size-full place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#3a3d44_0%,#15161a_80%)] text-neutral-200">
          {photoUrl ? (
            // unoptimized: the photo is already a small square served by our own API.
            <Image src={photoUrl} alt="" fill unoptimized sizes="64px" className="object-cover object-[50%_20%]" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-[48%]" aria-hidden="true">
              <circle cx="12" cy="8.5" r="4" />
              <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0Z" />
            </svg>
          )}
        </span>
      </span>
      {online !== undefined && <span className="sr-only">{online ? " (online)" : " (away)"}</span>}
    </span>
  );
}

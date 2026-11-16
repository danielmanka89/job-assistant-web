import type { MetadataRoute } from "next";

/** Lets phones and tablets install the site as an app ("Add to Home Screen"): its own icon, full screen, no browser bar. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Job Assistant",
    short_name: "Job Assistant",
    description: "Tailor your resume to any job, track every application and prepare for calls.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f7fb",
    theme_color: "#2f6bff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

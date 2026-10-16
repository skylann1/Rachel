import type { MetadataRoute } from "next";

// Served by Next.js at /manifest.webmanifest and linked automatically in <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RACHEL K3",
    short_name: "RACHEL K3",
    description: "Sistem manajemen keselamatan dan izin kerja K3 (SIPERMIT K3)",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    // --primary: hsl(196 100% 47%) from app/globals.css
    theme_color: "#00b0f0",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

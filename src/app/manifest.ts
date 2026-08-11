import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CherryK — Learn Korean with clarity",
    short_name: "CherryK",
    description:
      "Turn Korean writing and handwriting into clear corrections and reviewed practice.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f8f8",
    theme_color: "#087b93",
    icons: [
      {
        src: "/brand/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

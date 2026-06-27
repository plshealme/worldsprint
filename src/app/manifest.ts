import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WordSprint",
    short_name: "WordSprint",
    description: "Learn it fast. Make it last.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

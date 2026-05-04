import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// HashRouter is used in-app, but the base path still matters for icons + manifest.
// If deploying to https://<user>.github.io/<repo>/, set VITE_BASE=/<repo>/ at build time.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/icon.svg"],
      manifest: {
        name: "Pulse",
        short_name: "Pulse",
        description: "Personal blood pressure and meal-planning tracker.",
        theme_color: "#2d5a3d",
        background_color: "#f4f1ec",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cache the app shell aggressively; data lives in IndexedDB so no API caching needed.
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        navigateFallback: base + "index.html",
      },
    }),
  ],
});

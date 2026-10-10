import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    VitePWA({
      devOptions: {
        enabled: true,
        type: "module",
      },

      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      injectRegister: "inline",
      manifest: {
        background_color: "#0a0a0a",
        categories: ["social", "chat"],
        description: "Secret end-to-end encrypted Nizhnevartovsk chat",

        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],

        icons: [
          {
            purpose: "any",
            sizes: "192x192",
            src: "/web-app-manifest-192x192.png",
            type: "image/png",
          },
          {
            purpose: "any",
            sizes: "512x512",
            src: "/web-app-manifest-512x512.png",
            type: "image/png",
          },
          {
            purpose: "maskable",
            sizes: "512x512",
            src: "/web-app-manifest-512x512.png",
            type: "image/png",
          },
        ],
        name: "A-Chat Network",

        orientation: "portrait",

        scope: "/",

        short_name: "A-Chat",

        start_url: "/",

        theme_color: "#0a0a0a",
      },

      registerType: "autoUpdate",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
  },
});

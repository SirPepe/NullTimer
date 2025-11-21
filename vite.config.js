import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import babel from "vite-plugin-babel";

export default defineConfig({
  plugins: [
    babel(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        short_name: "NullTimer",
        name: "NullTimer",
        description: "Very basic timer",
        start_url: ".",
        display: "fullscreen",
        theme_color: "#ffffff",
        background_color: "#000000",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});

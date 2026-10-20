import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.SITE_BASE_PATH || "/",
  publicDir: ".generated/public",
  server: { host: "127.0.0.1", port: 5180, strictPort: true },
  build: { sourcemap: false },
});

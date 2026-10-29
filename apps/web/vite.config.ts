// vite.config.ts: build and test configuration for the Called It web prototype.
// Client-only SPA: no server, no Twitch connection, nothing leaves the browser.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/specs/setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor libs into their own cacheable
        // chunks so a route page change doesn't bust the whole bundle.
        manualChunks: {
          // Keep the JSX runtime with react so it doesn't get parked in the
          // motion chunk — otherwise every page pulls framer-motion just for JSX.
          "react-vendor": [
            "react",
            "react-dom",
            "react-router-dom",
            "react/jsx-runtime",
          ],
          motion: ["framer-motion"],
        },
      },
    },
  },
});

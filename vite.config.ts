import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Shown in Sozlamalar → Ilova as the version.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: they rarely change, so after a
        // deploy phones keep them cached and download only our own code.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](firebase|@firebase|idb)[\\/]/.test(id)) return "firebase";
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/.test(id)) return "react";
          return undefined;
        },
      },
    },
  },
});

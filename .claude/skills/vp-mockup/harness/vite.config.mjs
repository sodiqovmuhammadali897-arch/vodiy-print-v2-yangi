// vite --config <this file> <this folder>   (run from the repo root so
// Tailwind's config is found). Imports whose path ends with a key below
// are swapped for the mock file in this folder.
import { fileURLToPath } from "url";
const R = "/home/user/vodiy-print-v2-yangi";
const H = fileURLToPath(new URL(".", import.meta.url));
const mocks = {
  "/lib/AuthContext": "auth.ts",
  "/lib/firestoreDb": "fsdb.ts",
  "/lib/permissions": "perm.ts",
  "./useKpiMonth": "kpiHook.example.ts", // the example page's data hook — replace for another page
};
export default {
  esbuild: { jsx: "automatic" },
  css: { postcss: R },
  server: { port: 5198, fs: { allow: ["/"] } },
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: { react: R + "/node_modules/react", "react-dom": R + "/node_modules/react-dom", "react-router-dom": R + "/node_modules/react-router-dom", "@remix-run/router": R + "/node_modules/@remix-run/router", "lucide-react": R + "/node_modules/lucide-react" },
  },
  plugins: [{ name: "mocks", enforce: "pre", resolveId(src, imp) { if (!imp || imp.startsWith(H)) return; for (const [k, v] of Object.entries(mocks)) if (src.endsWith(k)) return H + v; } }],
};

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "src/mobile"),
  envDir: __dirname,
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.MOBILE_RELEASE_VERSION || process.env.npm_package_version || "1.0.0"),
    "import.meta.env.VITE_LYCEUM_TARGET": JSON.stringify("mobile"),
    global: "globalThis",
  },
  build: {
    sourcemap: false,
    target: "es2022",
    outDir: path.resolve(__dirname, "dist-mobile"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("epubjs") || id.includes("jszip")) return "reader-epub";
          if (id.includes("react")) return "react-vendor";
          if (id.includes("lucide-react") || id.includes("motion")) return "ui-motion";
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});

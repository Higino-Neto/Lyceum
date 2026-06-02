/// <reference types="vitest" />
import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const optionalCanvasStub = path.resolve(__dirname, "scripts/shims/canvas-optional.cjs");

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            emptyOutDir: true,
            sourcemap: false,
            rollupOptions: {
              external: ["better-sqlite3", "bindings", "adm-zip"],
            },
            commonjsOptions: {
              ignoreDynamicRequires: true,
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
        vite: {
          build: {
            emptyOutDir: false,
            rollupOptions: {
              output: {
                entryFileNames: "preload.cjs",
                format: "cjs",
              },
            },
          },
        },
      },
      renderer:
        process.env.NODE_ENV === "test"
          ? undefined
          : {},
    }),
  ],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version || "1.0.0"),
    global: "globalThis",
  },
  optimizeDeps: {
    exclude: ["crypto"],
  },
  build: {
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@embedpdf") || id.includes("pdfjs-dist")) {
            return "reader-pdf";
          }

          if (id.includes("epubjs")) {
            return "reader-epub";
          }

          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts";
          }

          if (id.includes("@supabase")) {
            return "supabase";
          }

          if (id.includes("react")) {
            return "react-vendor";
          }

          if (id.includes("lucide-react") || id.includes("motion")) {
            return "ui-motion";
          }

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      canvas: optionalCanvasStub,
      crypto: "node:crypto",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "electron/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});

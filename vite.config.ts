/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import path from "node:path";
import { execFileSync } from "node:child_process";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const optionalCanvasStub = path.resolve(__dirname, "scripts/shims/canvas-optional.cjs");
const browserEvents = path.resolve(__dirname, "node_modules/events/events.js");
const isLegacyWindowsBuild = process.env.LYCEUM_LEGACY_WINDOWS === "1";
const rendererTarget = isLegacyWindowsBuild ? "chrome108" : "es2022";
const electronTarget = isLegacyWindowsBuild ? "node16.17" : "node20";

function pdfjsOverlayDevPlugin(): Plugin {
  const overlayDir = path.resolve(__dirname, "resources/pdfjs-viewer");
  const coreDir = path.resolve(__dirname, "src/core/pdf-reader-core");
  const isInside = (file: string, directory: string) => {
    const relative = path.relative(directory, file);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
  };

  return {
    name: "lyceum-pdfjs-overlay-dev",
    apply: "serve",
    configureServer(server) {
      server.watcher.add([overlayDir, coreDir]);
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      let coreBuildTimer: ReturnType<typeof setTimeout> | undefined;
      let suppressGeneratedCoreUntil = 0;
      const generatedCore = path.join(overlayDir, "lyceum-core.mjs");
      const refresh = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          server.ws.send({ type: "custom", event: "lyceum:pdfjs-overlay-changed" });
        }, 150);
      };

      server.watcher.on("all", (event, file) => {
        if (!["add", "change", "unlink"].includes(event)) return;
        if (isInside(file, coreDir)) {
          clearTimeout(coreBuildTimer);
          coreBuildTimer = setTimeout(() => {
            try {
              suppressGeneratedCoreUntil = Date.now() + 1000;
              execFileSync(process.execPath, ["scripts/build-lyceum-core.mjs"], {
                cwd: __dirname,
                stdio: "inherit",
              });
              refresh();
            } catch (error) {
              server.config.logger.error(`[lyceum-pdfjs] Could not rebuild viewer core: ${String(error)}`);
            }
          }, 150);
        } else if (isInside(file, overlayDir)) {
          if (file === generatedCore && Date.now() < suppressGeneratedCoreUntil) return;
          refresh();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pdfjsOverlayDevPlugin(),
    electron({
      main: {
        entry: {
          main: "electron/main.ts",
          "workers/processing.worker": "electron/workers/processing.worker.ts",
        },
        vite: {
          resolve: {
            alias: {
              canvas: optionalCanvasStub,
            },
          },
          build: {
            target: electronTarget,
            emptyOutDir: true,
            sourcemap: false,
            rollupOptions: {
              external: [
                "better-sqlite3",
                "bindings",
                "adm-zip",
                "jsdom",
                "@napi-rs/canvas",
                "pdfjs-dist/legacy/build/pdf.mjs",
              ],
              output: {
                entryFileNames: "[name].js",
                chunkFileNames: "chunks/[name].js",
                assetFileNames: "assets/[name][extname]",
              },
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
            target: electronTarget,
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
    entries: ["index.html"],
    exclude: ["crypto"],
    include: ["events", "graphology", "graphology-layout-forceatlas2", "sigma"],
  },
  build: {
    sourcemap: false,
    target: rendererTarget,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("pdfjs-dist")) {
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
      events: browserEvents,
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

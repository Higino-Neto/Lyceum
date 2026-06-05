import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.higino.lyceum.mobile",
  appName: "Lyceum Mobile",
  webDir: "dist-mobile",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      appReadyTimeout: 10000,
      statsUrl: "",
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#09090b",
    },
  },
};

export default config;

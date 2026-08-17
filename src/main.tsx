import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./App.tsx";
import "./index.css";
import { HashRouter, BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppSettingsProvider, useAppSettings } from "./contexts/AppSettingsContext.tsx";

const isDev = import.meta.env.DEV;

const Router = isDev ? BrowserRouter : HashRouter;

const queryClient = new QueryClient();

function Root() {
  const { settings } = useAppSettings();
  return (
    <MotionConfig reducedMotion={settings.reducedEffects ? "always" : "never"}>
      <Router>
        <App />
      </Router>
    </MotionConfig>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <Root />
      </AppSettingsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

// // Use contextBridge
// window.ipcRenderer.on("main-process-message", (_event, message) => {
//   console.log(message);
// });

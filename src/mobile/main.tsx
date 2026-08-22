import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../index.css";
import MobileApp from "./MobileApp";
import MobileErrorBoundary from "./MobileErrorBoundary";
import { initializeMobileUpdater } from "./mobileUpdater";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => navigator.onLine !== false && failureCount < 2 && !(error instanceof Error && /auth|jwt|permission|not configured/i.test(error.message)),
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
      networkMode: "online",
    },
    mutations: { networkMode: "online" },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MobileErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MobileApp />
      </QueryClientProvider>
    </MobileErrorBoundary>
  </React.StrictMode>,
);

requestAnimationFrame(() => {
  void initializeMobileUpdater();
});

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../index.css";
import MobileApp from "./MobileApp";
import { initializeMobileUpdater } from "./mobileUpdater";

void initializeMobileUpdater();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MobileApp />
    </QueryClientProvider>
  </React.StrictMode>,
);

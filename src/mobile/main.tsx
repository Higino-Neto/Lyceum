import React from "react";
import ReactDOM from "react-dom/client";
import "../index.css";
import MobileApp from "./MobileApp";
import { initializeMobileUpdater } from "./mobileUpdater";

void initializeMobileUpdater();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>,
);

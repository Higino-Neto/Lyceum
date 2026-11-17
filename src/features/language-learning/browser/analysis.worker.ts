/// <reference lib="webworker" />
import { analyzeBook, type AnalyzeBookRequest } from "./analyzeBook";

/** Runs the linguistic analysis off the UI thread (large books take seconds). */
self.onmessage = (event: MessageEvent<AnalyzeBookRequest>) => {
  try {
    let last = 0;
    const result = analyzeBook(event.data, (value) => {
      if (value - last >= 0.02 || value >= 1) {
        last = value;
        self.postMessage({ type: "progress", value });
      }
    });
    self.postMessage({ type: "done", result });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};

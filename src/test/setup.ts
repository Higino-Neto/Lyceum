/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import React from "react";

vi.mock("@atomic-editor/editor", () => ({
  AtomicCodeMirrorEditor: ({
    markdownSource,
    onMarkdownChange,
  }: {
    markdownSource: string;
    onMarkdownChange?: (value: string) => void;
  }) => React.createElement("textarea", {
    "aria-label": "Atomic markdown editor",
    value: markdownSource,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
      onMarkdownChange?.(event.target.value),
  }),
}));

afterEach(() => {
  if (typeof window !== "undefined") {
    cleanup();
  }
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

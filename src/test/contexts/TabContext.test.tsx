import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TabProvider, useTabContext } from "../../contexts/TabContext";

const STORAGE_KEY = "lyceum_document_tabs";

function ActiveTabProbe() {
  const { activeTab } = useTabContext();

  return (
    <div>
      <span data-testid="active-file-path">{activeTab?.filePath || ""}</span>
      <span data-testid="active-buffer">
        {activeTab?.buffer ? "loaded" : "missing"}
      </span>
    </div>
  );
}

function AddCachedTabOnMount({ buffer }: { buffer: ArrayBuffer }) {
  const { addTab } = useTabContext();

  useEffect(() => {
    addTab("hash-cached-tab", "Cached.pdf", "pdf", {
      buffer,
      filePath: "C:\\Books\\Cached.pdf",
      source: "library",
    });
  }, [addTab, buffer]);

  return <ActiveTabProbe />;
}

describe("TabProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "api", {
      value: {
        openDocumentByHash: vi.fn().mockResolvedValue({
          fileBuffer: new Uint8Array([1, 2, 3]).buffer,
          fileHash: "hash-restored-tab",
          filePath: "C:\\Books\\Restored.pdf",
          fileType: "pdf",
          fileName: "Restored.pdf",
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as Partial<Window>).api;
  });

  it("uses the persisted file path when hydrating a restored tab", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeTabId: "tab-restored",
        tabs: [
          {
            id: "tab-restored",
            fileHash: "hash-restored-tab",
            fileName: "Restored.pdf",
            fileType: "pdf",
            filePath: "C:\\Books\\Restored.pdf",
            position: 0,
            source: "library",
          },
        ],
      }),
    );

    render(
      <TabProvider>
        <ActiveTabProbe />
      </TabProvider>,
    );

    await waitFor(() => {
      expect(window.api.openDocumentByHash).toHaveBeenCalledWith(
        "hash-restored-tab",
        "C:\\Books\\Restored.pdf",
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("active-buffer")).toHaveTextContent("loaded");
    });
  });

  it("keeps incoming buffers available after leaving and returning to reading", async () => {
    const openDocumentByHash = window.api.openDocumentByHash as ReturnType<typeof vi.fn>;
    const fileBuffer = new Uint8Array([4, 5, 6]).buffer;

    const firstRender = render(
      <TabProvider>
        <AddCachedTabOnMount buffer={fileBuffer} />
      </TabProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-buffer")).toHaveTextContent("loaded");
      expect(localStorage.getItem(STORAGE_KEY)).toContain("hash-cached-tab");
    });

    firstRender.unmount();
    openDocumentByHash.mockClear();

    render(
      <TabProvider>
        <ActiveTabProbe />
      </TabProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-buffer")).toHaveTextContent("loaded");
    });
    expect(openDocumentByHash).not.toHaveBeenCalled();
  });
});

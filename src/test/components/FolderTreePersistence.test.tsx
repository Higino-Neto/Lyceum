import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FolderTree from "../../pages/Library/components/FolderTree";
import type { FolderInfo } from "../../types/LibraryTypes";

const folder = (path: string, hasChildren: boolean): FolderInfo => ({
  name: path.split("/").pop()!,
  path,
  fullPath: `/library/${path}`,
  bookCount: 0,
  subfolders: [],
  hasChildren,
  isLoaded: false,
});

const tree: Record<string, FolderInfo[]> = {
  root: [folder("Fiction", true), folder("Science", false)],
  Fiction: [folder("Fiction/Classics", true)],
  "Fiction/Classics": [folder("Fiction/Classics/Russian", false)],
};

function renderTree() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FolderTree selectedFolder={null} onFolderSelect={() => undefined} />
    </QueryClientProvider>,
  );
}

describe("FolderTree expanded state", () => {
  beforeEach(() => {
    localStorage.clear();
    (window as unknown as { api: unknown }).api = {
      getFolderChildren: vi.fn(async (parent: string | null) => tree[parent ?? "root"] ?? []),
      getLibraryPath: vi.fn(async () => "/library"),
      onFolderChanged: vi.fn(() => () => undefined),
    };
  });

  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it("restores nested expanded folders after the tree remounts", async () => {
    const first = renderTree();
    await screen.findByText("Fiction");
    fireEvent.click(screen.getByText("Fiction").closest("div")!.querySelector("button")!);
    await screen.findByText("Classics");
    fireEvent.click(screen.getByText("Classics").closest("div")!.querySelector("button")!);
    await screen.findByText("Russian");
    first.unmount();

    renderTree();
    await waitFor(() => expect(screen.getByText("Russian")).toBeInTheDocument());
  });

  it("keeps loaded children when the root query refetches", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FolderTree selectedFolder={null} onFolderSelect={() => undefined} />
      </QueryClientProvider>,
    );
    await screen.findByText("Fiction");
    fireEvent.click(screen.getByText("Fiction").closest("div")!.querySelector("button")!);
    await screen.findByText("Classics");
    await act(async () => {
      await client.invalidateQueries();
    });
    await waitFor(() => expect(screen.getByText("Classics")).toBeInTheDocument());
  });
});

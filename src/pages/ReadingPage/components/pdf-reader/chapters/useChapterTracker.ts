import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadChapterState, saveChapterState } from "./ChapterStorage";
import {
  CMD_GET_OUTLINE,
  CMD_NAVIGATE,
  EVT_OUTLINE_LOADED,
  type OutlineNode,
  type PdfViewerEvent,
} from "../pdfBridgeProtocol";

export interface ChapterNode {
  id: string;
  title: string;
  page: number | null;
  depth: number;
  hasChildren: boolean;
  children: ChapterNode[];
}

function buildTree(nodes: OutlineNode[], parentId: string, depth: number): ChapterNode[] {
  return nodes.map((node, index) => {
    const id = parentId ? `${parentId}/${index}` : `${index}`;
    const children = Array.isArray(node.items)
      ? buildTree(node.items, id, depth + 1)
      : [];
    return {
      id,
      title: node.title || "(sem título)",
      page: typeof node.page === "number" ? node.page : null,
      depth,
      hasChildren: children.length > 0,
      children,
    };
  });
}

function countNodes(nodes: ChapterNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

function countRead(nodes: ChapterNode[], readMap: Record<string, boolean>): number {
  return nodes.reduce(
    (total, node) =>
      total + (readMap[node.id] ? 1 : 0) + countRead(node.children, readMap),
    0,
  );
}

function collectNodeAndDescendantIds(node: ChapterNode, target: string[]): void {
  target.push(node.id);
  node.children.forEach((child) => collectNodeAndDescendantIds(child, target));
}

function findSubtreeIds(nodes: ChapterNode[], targetId: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      const ids: string[] = [];
      collectNodeAndDescendantIds(node, ids);
      return ids;
    }
    const found = findSubtreeIds(node.children, targetId);
    if (found) {
      return found;
    }
  }
  return null;
}

export interface ChapterTracker {
  outline: ChapterNode[] | null;
  loading: boolean;
  error: string | null;
  hasOutline: boolean;
  readMap: Record<string, boolean>;
  expandedMap: Record<string, boolean>;
  toggleRead: (id: string) => void;
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, value: boolean) => void;
  goToPage: (page: number | null) => void;
  totalCount: number;
  readCount: number;
  progress: number;
}

export interface ChapterTrackerChannelOptions {
  postToViewer: (type: string, payload?: Record<string, unknown>) => void;
  subscribeToViewerEvents: (handler: (data: PdfViewerEvent) => void) => () => void;
}

export function useChapterTracker(
  sourceUrl: string,
  fileHash: string,
  channel: ChapterTrackerChannelOptions,
  documentReady = false,
  onBeforeNavigate?: () => void,
): ChapterTracker {
  const [outline, setOutline] = useState<ChapterNode[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [readMap, setReadMap] = useState<Record<string, boolean>>(() =>
    fileHash ? loadChapterState(fileHash).read : {},
  );
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() =>
    fileHash ? loadChapterState(fileHash).expanded : {},
  );
  const outlineRef = useRef<ChapterNode[] | null>(null);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    outlineRef.current = outline;
  }, [outline]);
  useEffect(() => {
    if (!fileHash) {
      return;
    }
    const stored = loadChapterState(fileHash);
    setReadMap(stored.read);
    setExpandedMap(stored.expanded);
    setOutline(null);
  }, [fileHash]);

  useEffect(() => {
    if (!sourceUrl || !fileHash || !documentReady) {
      return;
    }

    const requestId = String(Date.now());
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    channel.postToViewer(CMD_GET_OUTLINE, { requestId });
  }, [sourceUrl, fileHash, documentReady, channel]);

  useEffect(
    () => channel.subscribeToViewerEvents((data) => {
      if (data.type !== EVT_OUTLINE_LOADED) {
        return;
      }
      if (data.requestId !== undefined && data.requestId !== requestIdRef.current) {
        return;
      }
      setOutline(buildTree(data.outline ?? [], "", 0));
      setLoading(false);
      setError(null);
    }),
    [channel],
  );

  useEffect(() => {
    if (!fileHash) {
      return;
    }
    saveChapterState(fileHash, { read: readMap, expanded: expandedMap });
  }, [readMap, expandedMap, fileHash]);

  const toggleRead = useCallback((id: string) => {
    setReadMap((prev) => {
      const subtreeIds = findSubtreeIds(outlineRef.current ?? [], id) ?? [id];
      const nextValue = !prev[id];
      const updated = { ...prev };
      subtreeIds.forEach((targetId) => {
        updated[targetId] = nextValue;
      });
      return updated;
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setExpanded = useCallback((id: string, value: boolean) => {
    setExpandedMap((prev) => ({ ...prev, [id]: value }));
  }, []);

  const goToPage = useCallback(
    (page: number | null) => {
      if (!page) {
        return;
      }
      onBeforeNavigate?.();
      channel.postToViewer(CMD_NAVIGATE, { page });
    },
    [channel, onBeforeNavigate],
  );

  const totalCount = useMemo(() => (outline ? countNodes(outline) : 0), [outline]);
  const readCount = useMemo(
    () => (outline ? countRead(outline, readMap) : 0),
    [outline, readMap],
  );
  const progress = useMemo(
    () => (totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0),
    [totalCount, readCount],
  );

  return {
    outline,
    loading,
    error,
    hasOutline: outline !== null && outline.length > 0,
    readMap,
    expandedMap,
    toggleRead,
    toggleExpanded,
    setExpanded,
    goToPage,
    totalCount,
    readCount,
    progress,
  };
}
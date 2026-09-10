import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnnotatedPage,
  ConceptGraphPayload,
  ConceptRelation,
  CreateKeyConceptInput,
  KeyConcept,
  UpdateKeyConceptInput,
} from "../../../../../types/AnnotationTypes";

const EMPTY_GRAPH: ConceptGraphPayload = { concepts: [], relations: [] };

export function useKeyConcepts(bookId: string, currentPage: number) {
  const [graph, setGraph] = useState<ConceptGraphPayload>(EMPTY_GRAPH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!bookId || !window.api?.getConceptGraph) {
      setGraph(EMPTY_GRAPH);
      return EMPTY_GRAPH;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await window.api.getConceptGraph(bookId);
      if (!result.success || !result.payload) {
        throw new Error(result.error || "Nao foi possivel carregar concepts");
      }
      setGraph(result.payload);
      return result.payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setGraph(EMPTY_GRAPH);
      return EMPTY_GRAPH;
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyGraphResult = useCallback((result: { success: boolean; payload?: ConceptGraphPayload; error?: string }) => {
    if (!result.success || !result.payload) {
      throw new Error(result.error || "Nao foi possivel atualizar concepts");
    }
    setGraph(result.payload);
    setError(null);
    window.dispatchEvent(new CustomEvent("lyceum:annotations-updated", { detail: { bookId } }));
    return result.payload;
  }, [bookId]);

  const createConcept = useCallback(async (input: Omit<CreateKeyConceptInput, "bookId">) => {
    const result = await window.api.createKeyConcept({ ...input, bookId });
    return applyGraphResult(result);
  }, [applyGraphResult, bookId]);

  const updateConcept = useCallback(async (id: string, updates: UpdateKeyConceptInput) => {
    const result = await window.api.updateKeyConcept(id, updates);
    return applyGraphResult(result);
  }, [applyGraphResult]);

  const deleteConcept = useCallback(async (id: string) => {
    const result = await window.api.deleteKeyConcept(id, bookId);
    return applyGraphResult(result);
  }, [applyGraphResult, bookId]);

  const createRelation = useCallback(async (conceptAId: string, conceptBId: string) => {
    const result = await window.api.createConceptRelation(bookId, conceptAId, conceptBId);
    return applyGraphResult(result);
  }, [applyGraphResult, bookId]);

  const deleteRelation = useCallback(async (relation: Pick<ConceptRelation, "conceptAId" | "conceptBId">) => {
    const result = await window.api.deleteConceptRelation(bookId, relation.conceptAId, relation.conceptBId);
    return applyGraphResult(result);
  }, [applyGraphResult, bookId]);

  const conceptsById = useMemo(
    () => new Map(graph.concepts.map((concept) => [concept.id, concept])),
    [graph.concepts],
  );

  const currentPageConcepts = useMemo(
    () => graph.concepts
      .filter((concept) => concept.page === currentPage)
      .sort((a, b) => a.title.localeCompare(b.title)),
    [currentPage, graph.concepts],
  );

  const annotatedPages = useMemo<AnnotatedPage[]>(() => {
    const pages = new Map<number, KeyConcept[]>();
    for (const concept of graph.concepts) {
      const pageConcepts = pages.get(concept.page) ?? [];
      pageConcepts.push(concept);
      pages.set(concept.page, pageConcepts);
    }
    return Array.from(pages.entries())
      .sort(([a], [b]) => a - b)
      .map(([page, concepts]) => ({
        bookId,
        page,
        conceptCount: concepts.length,
        concepts: concepts.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [bookId, graph.concepts]);

  return {
    annotatedPages,
    conceptsById,
    createConcept,
    createRelation,
    currentPageConcepts,
    deleteConcept,
    deleteRelation,
    error,
    graph,
    loading,
    refresh,
    updateConcept,
  };
}

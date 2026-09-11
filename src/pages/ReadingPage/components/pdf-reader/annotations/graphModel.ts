import type { ConceptRelation, KeyConcept } from "../../../../../types/AnnotationTypes";

export interface ConceptGraphNodeModel {
  id: string;
  label: string;
  page: number;
  degree: number;
  color: string;
  size: number;
}

export interface ConceptGraphEdgeModel {
  id: string;
  source: string;
  target: string;
}

export interface ConceptGraphModel {
  nodes: ConceptGraphNodeModel[];
  edges: ConceptGraphEdgeModel[];
}

export function relationKey(relation: Pick<ConceptRelation, "conceptAId" | "conceptBId">) {
  return [relation.conceptAId, relation.conceptBId].sort().join("::");
}

export function buildConceptGraphModel(
  concepts: KeyConcept[],
  relations: ConceptRelation[],
): ConceptGraphModel {
  const visibleIds = new Set(concepts.map((concept) => concept.id));
  const degree = new Map(concepts.map((concept) => [concept.id, 0]));
  const edges: ConceptGraphEdgeModel[] = [];

  for (const relation of relations) {
    if (!visibleIds.has(relation.conceptAId) || !visibleIds.has(relation.conceptBId)) {
      continue;
    }

    degree.set(relation.conceptAId, (degree.get(relation.conceptAId) ?? 0) + 1);
    degree.set(relation.conceptBId, (degree.get(relation.conceptBId) ?? 0) + 1);
    edges.push({
      id: relationKey(relation),
      source: relation.conceptAId,
      target: relation.conceptBId,
    });
  }

  return {
    nodes: concepts.map((concept) => {
      const conceptDegree = degree.get(concept.id) ?? 0;
      return {
        id: concept.id,
        label: concept.title,
        page: concept.page,
        degree: conceptDegree,
        color: conceptDegree > 0 ? "#22c55e" : "#71717a",
        size: 7 + Math.min(10, conceptDegree * 2.5),
      };
    }),
    edges,
  };
}

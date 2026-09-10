export interface KeyConcept {
  id: string;
  bookId: string;
  title: string;
  note: string | null;
  page: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptRelation {
  bookId: string;
  conceptAId: string;
  conceptBId: string;
  createdAt: string;
}

export interface ConceptGraphPayload {
  concepts: KeyConcept[];
  relations: ConceptRelation[];
}

export interface AnnotatedPage {
  bookId: string;
  page: number;
  conceptCount: number;
  concepts: KeyConcept[];
}

export interface CreateKeyConceptInput {
  bookId: string;
  title: string;
  note?: string | null;
  page: number;
}

export interface UpdateKeyConceptInput {
  title?: string;
  note?: string | null;
  page?: number;
}

export interface AnnotationResult<T> {
  success: boolean;
  payload?: T;
  error?: string;
}

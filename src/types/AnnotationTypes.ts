export interface KeyConcept {
  id: string;
  bookId: string;
  title: string;
  note: string | null;
  excerpt: string | null;
  locatorJson: string | null;
  highlightJson: string | null;
  page: number;
  createdAt: string;
  updatedAt: string;
}

export interface PdfSelectionRect {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfSelectionPayload {
  text: string;
  page: number;
  rects: PdfSelectionRect[];
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
  excerpt?: string | null;
  locatorJson?: string | null;
  highlightJson?: string | null;
  page: number;
}

export interface UpdateKeyConceptInput {
  title?: string;
  note?: string | null;
  excerpt?: string | null;
  locatorJson?: string | null;
  highlightJson?: string | null;
  page?: number;
}

export interface AnnotationResult<T> {
  success: boolean;
  payload?: T;
  error?: string;
}

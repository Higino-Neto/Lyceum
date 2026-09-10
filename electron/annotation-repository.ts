import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  AnnotatedPage,
  ConceptGraphPayload,
  ConceptRelation,
  CreateKeyConceptInput,
  KeyConcept,
  UpdateKeyConceptInput,
} from "../src/types/AnnotationTypes";

type SqliteDatabase = Database.Database;

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function normalizePage(page: number): number {
  const clean = Math.round(Number(page));
  if (!Number.isFinite(clean) || clean < 1) {
    throw new Error("Pagina invalida para o conceito");
  }
  return clean;
}

function assertBookId(bookId: string): string {
  const clean = String(bookId || "").trim();
  if (!clean) throw new Error("Livro invalido para annotations");
  return clean;
}

function orderedConceptPair(conceptAId: string, conceptBId: string): [string, string] {
  const a = String(conceptAId || "").trim();
  const b = String(conceptBId || "").trim();
  if (!a || !b) throw new Error("Conceitos invalidos para relacao");
  if (a === b) throw new Error("Um conceito nao pode se relacionar consigo mesmo");
  return a < b ? [a, b] : [b, a];
}

export function ensureAnnotationSchema(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS key_concepts (
      id TEXT PRIMARY KEY,
      bookId TEXT NOT NULL,
      title TEXT NOT NULL,
      note TEXT,
      page INTEGER NOT NULL CHECK (page >= 1),
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS concept_relations (
      bookId TEXT NOT NULL,
      conceptAId TEXT NOT NULL,
      conceptBId TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conceptAId, conceptBId),
      CHECK (conceptAId <> conceptBId),
      CHECK (conceptAId < conceptBId),
      FOREIGN KEY (conceptAId) REFERENCES key_concepts(id) ON DELETE CASCADE,
      FOREIGN KEY (conceptBId) REFERENCES key_concepts(id) ON DELETE CASCADE
    )
  `);

  database.exec(`CREATE INDEX IF NOT EXISTS idx_key_concepts_book ON key_concepts(bookId, updatedAt DESC)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_key_concepts_book_page ON key_concepts(bookId, page, title COLLATE NOCASE)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_key_concepts_title ON key_concepts(bookId, title COLLATE NOCASE)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_concept_relations_book ON concept_relations(bookId)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_concept_relations_a ON concept_relations(conceptAId)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_concept_relations_b ON concept_relations(conceptBId)`);
}

export function createAnnotationRepository(database: SqliteDatabase) {
  ensureAnnotationSchema(database);

  function getConceptById(id: string): KeyConcept | undefined {
    return database.prepare<[string], KeyConcept>(
      `SELECT * FROM key_concepts WHERE id = ?`,
    ).get(id);
  }

  function getConceptsByBook(bookId: string): KeyConcept[] {
    return database.prepare<[string], KeyConcept>(
      `SELECT * FROM key_concepts
       WHERE bookId = ?
       ORDER BY page ASC, title COLLATE NOCASE ASC, createdAt ASC`,
    ).all(assertBookId(bookId));
  }

  function getConceptsByPage(bookId: string, page: number): KeyConcept[] {
    return database.prepare<[string, number], KeyConcept>(
      `SELECT * FROM key_concepts
       WHERE bookId = ? AND page = ?
       ORDER BY title COLLATE NOCASE ASC, createdAt ASC`,
    ).all(assertBookId(bookId), normalizePage(page));
  }

  function getRelationsByBook(bookId: string): ConceptRelation[] {
    return database.prepare<[string], ConceptRelation>(
      `SELECT * FROM concept_relations
       WHERE bookId = ?
       ORDER BY createdAt ASC`,
    ).all(assertBookId(bookId));
  }

  function getGraph(bookId: string): ConceptGraphPayload {
    return {
      concepts: getConceptsByBook(bookId),
      relations: getRelationsByBook(bookId),
    };
  }

  function createConcept(input: CreateKeyConceptInput): KeyConcept {
    const bookId = assertBookId(input.bookId);
    const title = normalizeTitle(input.title);
    if (!title) throw new Error("Titulo do conceito e obrigatorio");
    const page = normalizePage(input.page);
    const id = `concept-${randomUUID()}`;
    const note = input.note?.trim() || null;

    database.prepare(`
      INSERT INTO key_concepts (id, bookId, title, note, page)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, bookId, title, note, page);

    return getConceptById(id)!;
  }

  function updateConcept(id: string, updates: UpdateKeyConceptInput): KeyConcept {
    const existing = getConceptById(id);
    if (!existing) throw new Error("Conceito nao encontrado");

    const title = updates.title !== undefined
      ? normalizeTitle(updates.title)
      : existing.title;
    if (!title) throw new Error("Titulo do conceito e obrigatorio");
    const page = updates.page !== undefined ? normalizePage(updates.page) : existing.page;
    const note = updates.note !== undefined ? updates.note?.trim() || null : existing.note;

    database.prepare(`
      UPDATE key_concepts
      SET title = ?,
          note = ?,
          page = ?,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, note, page, id);

    return getConceptById(id)!;
  }

  function deleteConcept(id: string): boolean {
    const removeRelations = database.prepare(`
      DELETE FROM concept_relations WHERE conceptAId = ? OR conceptBId = ?
    `);
    const removeConcept = database.prepare(`DELETE FROM key_concepts WHERE id = ?`);
    const run = database.transaction((conceptId: string) => {
      removeRelations.run(conceptId, conceptId);
      return removeConcept.run(conceptId).changes > 0;
    });
    return run(id);
  }

  function createRelation(bookIdInput: string, conceptAId: string, conceptBId: string): ConceptRelation {
    const bookId = assertBookId(bookIdInput);
    const [conceptAIdOrdered, conceptBIdOrdered] = orderedConceptPair(conceptAId, conceptBId);
    const a = getConceptById(conceptAIdOrdered);
    const b = getConceptById(conceptBIdOrdered);
    if (!a || !b) throw new Error("Conceito nao encontrado para relacao");
    if (a.bookId !== bookId || b.bookId !== bookId) {
      throw new Error("Relacao so pode conectar conceitos do mesmo livro");
    }

    database.prepare(`
      INSERT OR IGNORE INTO concept_relations (bookId, conceptAId, conceptBId)
      VALUES (?, ?, ?)
    `).run(bookId, conceptAIdOrdered, conceptBIdOrdered);

    return database.prepare<[string, string], ConceptRelation>(
      `SELECT * FROM concept_relations WHERE conceptAId = ? AND conceptBId = ?`,
    ).get(conceptAIdOrdered, conceptBIdOrdered)!;
  }

  function deleteRelation(conceptAId: string, conceptBId: string): boolean {
    const [conceptAIdOrdered, conceptBIdOrdered] = orderedConceptPair(conceptAId, conceptBId);
    const result = database.prepare(`
      DELETE FROM concept_relations WHERE conceptAId = ? AND conceptBId = ?
    `).run(conceptAIdOrdered, conceptBIdOrdered);
    return result.changes > 0;
  }

  function getRelatedConcepts(conceptId: string): KeyConcept[] {
    return database.prepare<[string, string], KeyConcept>(
      `SELECT c.*
       FROM key_concepts c
       INNER JOIN concept_relations r
         ON (r.conceptAId = ? AND c.id = r.conceptBId)
         OR (r.conceptBId = ? AND c.id = r.conceptAId)
       ORDER BY c.title COLLATE NOCASE ASC`,
    ).all(conceptId, conceptId);
  }

  function getAnnotatedPages(bookIdInput: string): AnnotatedPage[] {
    const bookId = assertBookId(bookIdInput);
    const concepts = getConceptsByBook(bookId);
    const pages = new Map<number, KeyConcept[]>();
    for (const concept of concepts) {
      const pageConcepts = pages.get(concept.page) ?? [];
      pageConcepts.push(concept);
      pages.set(concept.page, pageConcepts);
    }
    return Array.from(pages.entries())
      .sort(([a], [b]) => a - b)
      .map(([page, pageConcepts]) => ({
        bookId,
        page,
        conceptCount: pageConcepts.length,
        concepts: pageConcepts,
      }));
  }

  return {
    createConcept,
    updateConcept,
    deleteConcept,
    createRelation,
    deleteRelation,
    getAnnotatedPages,
    getConceptById,
    getConceptsByBook,
    getConceptsByPage,
    getGraph,
    getRelatedConcepts,
    getRelationsByBook,
  };
}

export type AnnotationRepository = ReturnType<typeof createAnnotationRepository>;

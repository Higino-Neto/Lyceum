import { createRequire } from "node:module";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createAnnotationRepository } from "./annotation-repository";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): { changes?: number };
    };
    close(): void;
  };
};

class TestDatabase {
  readonly inner = new DatabaseSync(":memory:");

  exec(sql: string) {
    this.inner.exec(sql);
  }

  prepare(sql: string) {
    return this.inner.prepare(sql);
  }

  pragma(source: string) {
    this.inner.exec(`PRAGMA ${source}`);
  }

  transaction<TArgs extends unknown[], TResult>(task: (...args: TArgs) => TResult) {
    return (...args: TArgs) => {
      this.inner.exec("BEGIN");
      try {
        const result = task(...args);
        this.inner.exec("COMMIT");
        return result;
      } catch (error) {
        this.inner.exec("ROLLBACK");
        throw error;
      }
    };
  }

  close() {
    this.inner.close();
  }
}

const databases: TestDatabase[] = [];

function createRepository() {
  const database = new TestDatabase();
  database.pragma("foreign_keys = ON");
  databases.push(database);
  return createAnnotationRepository(database as unknown as Database.Database);
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
});

describe("key concept annotations", () => {
  it("creates, updates and deletes key concepts without requiring a document row", () => {
    const repository = createRepository();

    const concept = repository.createConcept({
      bookId: "book-hash",
      title: "  Replication   Lag  ",
      page: 183,
    });

    expect(concept).toMatchObject({
      bookId: "book-hash",
      title: "Replication Lag",
      note: null,
      page: 183,
    });

    const updated = repository.updateConcept(concept.id, {
      note: "Follower state can be behind the leader.",
      page: 184,
    });
    expect(updated.note).toBe("Follower state can be behind the leader.");
    expect(updated.page).toBe(184);

    expect(repository.deleteConcept(concept.id)).toBe(true);
    expect(repository.getConceptsByBook("book-hash")).toEqual([]);
  });

  it("creates simple bidirectional relations and prevents duplicates and self-relations", () => {
    const repository = createRepository();
    const replication = repository.createConcept({ bookId: "book-hash", title: "Replication", page: 10 });
    const lag = repository.createConcept({ bookId: "book-hash", title: "Replication Lag", page: 12 });

    const relation = repository.createRelation("book-hash", lag.id, replication.id);
    expect(relation.conceptAId).toBe(replication.id < lag.id ? replication.id : lag.id);
    expect(repository.getRelationsByBook("book-hash")).toHaveLength(1);

    repository.createRelation("book-hash", replication.id, lag.id);
    expect(repository.getRelationsByBook("book-hash")).toHaveLength(1);
    expect(repository.getRelatedConcepts(replication.id).map((concept) => concept.id)).toEqual([lag.id]);
    expect(() => repository.createRelation("book-hash", replication.id, replication.id)).toThrow();

    expect(repository.deleteRelation(lag.id, replication.id)).toBe(true);
    expect(repository.getRelationsByBook("book-hash")).toEqual([]);
  });

  it("queries concepts by book, page and annotated pages", () => {
    const repository = createRepository();
    const first = repository.createConcept({ bookId: "book-hash", title: "Quorum", page: 21 });
    repository.createConcept({ bookId: "book-hash", title: "Linearizability", page: 21 });
    repository.createConcept({ bookId: "book-hash", title: "Serializability", page: 35 });
    repository.createConcept({ bookId: "other-book", title: "Index", page: 21 });

    expect(repository.getConceptsByBook("book-hash")).toHaveLength(3);
    expect(repository.getConceptsByPage("book-hash", 21).map((concept) => concept.title)).toEqual([
      "Linearizability",
      "Quorum",
    ]);
    expect(repository.getAnnotatedPages("book-hash")).toMatchObject([
      { page: 21, conceptCount: 2 },
      { page: 35, conceptCount: 1 },
    ]);

    repository.deleteConcept(first.id);
    expect(repository.getAnnotatedPages("book-hash")).toMatchObject([
      { page: 21, conceptCount: 1 },
      { page: 35, conceptCount: 1 },
    ]);
  });

  it("rejects relations across different books", () => {
    const repository = createRepository();
    const a = repository.createConcept({ bookId: "book-a", title: "A", page: 1 });
    const b = repository.createConcept({ bookId: "book-b", title: "B", page: 1 });

    expect(() => repository.createRelation("book-a", a.id, b.id)).toThrow(
      "Relacao so pode conectar conceitos do mesmo livro",
    );
  });
});

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURRENT_SQLITE_SCHEMA_VERSION, runDatabaseMigrations } from "../database-migrations";
import { ensureApplicationSchema, ensureBootstrapSchema, ensurePostMigrationSchema } from "./sqlite-schema";
import { createSqliteHabitRepository } from "./sqlite-habit-repository";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureBootstrapSchema(db);
  runDatabaseMigrations(db, 1);
  ensureApplicationSchema(db);
  runDatabaseMigrations(db, CURRENT_SQLITE_SCHEMA_VERSION);
  ensurePostMigrationSchema(db);
});

afterEach(() => {
  db.close();
});

describe("SQLite habit repository", () => {
  it("persists, updates and removes habits and their completions", () => {
    const repository = createSqliteHabitRepository(db);
    repository.add({ id: "reading", name: "Ler", unit: null, valueMode: "toggle" });
    expect(repository.find("reading")).toMatchObject({ name: "Ler" });

    repository.update("reading", { name: "Ler diariamente", unit: "pages" });
    expect(repository.find("reading")).toMatchObject({ name: "Ler diariamente", unit: "pages" });
    repository.setCompletion("reading", "2026-09-18", "12");
    expect(repository.listCompletions("reading")).toEqual([
      { habitId: "reading", dateKey: "2026-09-18", value: "12" },
    ]);
    expect(repository.listAllCompletions()).toHaveLength(1);

    repository.remove("reading");
    expect(repository.list()).toEqual([]);
    expect(repository.listAllCompletions()).toEqual([]);
  });

  it("uses null completion values as deletion, preserving the existing contract", () => {
    const repository = createSqliteHabitRepository(db);
    repository.add({ id: "reading", name: "Ler", unit: null, valueMode: "toggle" });
    repository.setCompletion("reading", "2026-09-18", "1");
    repository.setCompletion("reading", "2026-09-18", null);
    expect(repository.listCompletions("reading")).toEqual([]);
  });
});

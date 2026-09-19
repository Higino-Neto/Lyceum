import path from "node:path";
import type Database from "better-sqlite3";
import type { BookCategory, CategoryRepository } from "../../src/core/library/category";

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#14b8a6",
];

const CATEGORY_SELECT = `SELECT c.id, c.name, c.color, c.createdAt,
  (SELECT COUNT(*) FROM document_categories dc WHERE dc.categoryId = c.id) AS bookCount
  FROM categories c`;

/** Implements the category port directly against an initialized SQLite connection. */
export function createSqliteCategoryRepository(
  db: Database.Database,
  libraryPath: string,
): CategoryRepository {
  return {
    create(name, color) {
      const finalColor = color || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)] || "#6b7280";
      try {
        const result = db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)")
          .run(name.trim(), finalColor);
        return {
          id: result.lastInsertRowid as number,
          name: name.trim(),
          color: finalColor,
          bookCount: 0,
          createdAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error("[DB] Error creating category:", error);
        return null;
      }
    },
    update(id, name, color) {
      try {
        db.prepare("UPDATE categories SET name = ?, color = ? WHERE id = ?")
          .run(name.trim(), color, id);
        return true;
      } catch (error) {
        console.error("[DB] Error updating category:", error);
        return false;
      }
    },
    remove(id) {
      try {
        db.prepare("DELETE FROM document_categories WHERE categoryId = ?").run(id);
        db.prepare("DELETE FROM categories WHERE id = ?").run(id);
        return true;
      } catch (error) {
        console.error("[DB] Error deleting category:", error);
        return false;
      }
    },
    list: () => db.prepare<[], BookCategory>(`${CATEGORY_SELECT} ORDER BY c.name`).all(),
    find: (id) => db.prepare<[number], BookCategory>(`${CATEGORY_SELECT} WHERE c.id = ?`).get(id) || null,
    listForDocument: (documentId) => db.prepare<[number], BookCategory>(`
      ${CATEGORY_SELECT}
      INNER JOIN document_categories dc ON c.id = dc.categoryId
      WHERE dc.documentId = ? ORDER BY c.name
    `).all(documentId),
    listForDocumentHash: (fileHash) => db.prepare<[string], BookCategory>(`
      ${CATEGORY_SELECT}
      INNER JOIN document_categories dc ON c.id = dc.categoryId
      INNER JOIN documents d ON dc.documentId = d.id
      WHERE d.fileHash = ? ORDER BY c.name
    `).all(fileHash),
    setForDocument(documentId, categoryIds) {
      try {
        db.prepare("DELETE FROM document_categories WHERE documentId = ?").run(documentId);
        for (const categoryId of categoryIds) {
          db.prepare("INSERT OR IGNORE INTO document_categories (documentId, categoryId) VALUES (?, ?)")
            .run(documentId, categoryId);
        }
        return true;
      } catch (error) {
        console.error("[DB] Error setting document categories:", error);
        return false;
      }
    },
    addToDocument(documentId, categoryId) {
      try {
        db.prepare("INSERT OR IGNORE INTO document_categories (documentId, categoryId) VALUES (?, ?)")
          .run(documentId, categoryId);
        return true;
      } catch (error) {
        console.error("[DB] Error adding category to document:", error);
        return false;
      }
    },
    removeFromDocument(documentId, categoryId) {
      try {
        db.prepare("DELETE FROM document_categories WHERE documentId = ? AND categoryId = ?")
          .run(documentId, categoryId);
        return true;
      } catch (error) {
        console.error("[DB] Error removing category from document:", error);
        return false;
      }
    },
    listColors: () => [...DEFAULT_COLORS],
    importFromFolders() {
      const documents = db.prepare<[], { id: number; filePath: string }>(
        "SELECT id, filePath FROM documents WHERE filePath IS NOT NULL",
      ).all();
      let imported = 0;
      for (const document of documents) {
        const relativePath = path.relative(libraryPath, document.filePath);
        const pathParts = relativePath.split(path.sep);
        if (pathParts.length <= 1) continue;
        const folderName = pathParts[0]!;
        let category = db.prepare<[string], { id: number }>(
          "SELECT id FROM categories WHERE name = ?",
        ).get(folderName);
        if (!category) {
          const result = db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)").run(
            folderName,
            DEFAULT_COLORS[imported % DEFAULT_COLORS.length] || "#6b7280",
          );
          category = { id: result.lastInsertRowid as number };
        }
        const existing = db.prepare<[number, number], { documentId: number }>(
          "SELECT documentId FROM document_categories WHERE documentId = ? AND categoryId = ?",
        ).get(document.id, category.id);
        if (!existing) {
          db.prepare("INSERT INTO document_categories (documentId, categoryId) VALUES (?, ?)")
            .run(document.id, category.id);
          imported++;
        }
      }
      return imported;
    },
  };
}

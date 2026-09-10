import { describe, expect, it } from "vitest";
import { buildDocumentBackupRpcParams, type BackupDocumentInput } from "./backup";

describe("document backup RPC contract", () => {
  it("keeps the legacy folder category separate from normalized category IDs", () => {
    const document: BackupDocumentInput = {
      id: 7,
      fileHash: "hash",
      title: "Livro.epub",
      filePath: "/library/Filosofia/Livro.epub",
      fileSize: 12,
      numPages: 3,
      currentPage: 1,
      currentZoom: null,
      currentScroll: null,
      annotations: null,
      thumbnailPath: null,
      createdAt: "2026-01-01",
      lastOpenedAt: "2026-01-02",
      isSynced: 1,
      isFavorite: 0,
      rating: 4,
      notes: null,
      author: "Autora",
      description: null,
      isbn: null,
      publisher: null,
      publishDate: null,
      category: "Filosofia",
      processingStatus: "completed",
      bookId: null,
      categoryIds: [2, 9],
      fileType: "epub",
    };

    const params = buildDocumentBackupRpcParams(document);
    expect(params.p_title).toBe("Livro");
    expect(params.p_category).toBe("Filosofia");
    expect(params.p_categories_json).toBe("[2,9]");
    expect(params.p_file_type).toBe("epub");
    expect(Object.keys(params)).toHaveLength(27);
  });
});

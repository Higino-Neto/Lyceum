export interface BookCategory {
  id: number;
  name: string;
  color: string;
  bookCount: number;
  createdAt: string;
}

export interface CategoryRepository {
  create(name: string, color?: string): BookCategory | null;
  update(id: number, name: string, color: string): boolean;
  remove(id: number): boolean;
  list(): BookCategory[];
  find(id: number): BookCategory | null;
  listForDocument(documentId: number): BookCategory[];
  listForDocumentHash(fileHash: string): BookCategory[];
  setForDocument(documentId: number, categoryIds: number[]): boolean;
  addToDocument(documentId: number, categoryId: number): boolean;
  removeFromDocument(documentId: number, categoryId: number): boolean;
  listColors(): string[];
  importFromFolders(): number;
}

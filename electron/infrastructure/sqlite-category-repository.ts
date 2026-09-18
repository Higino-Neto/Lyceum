import type { CategoryRepository } from "../../src/core/library/category";
import {
  addCategoryToDocument,
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoriesForDocument,
  getCategoriesForDocumentByHash,
  getCategoryById,
  getCategoryColors,
  importCategoriesFromFolders,
  removeCategoryFromDocument,
  setDocumentCategories,
  updateCategory,
} from "../local-database";

export const sqliteCategoryRepository: CategoryRepository = {
  create: createCategory,
  update: updateCategory,
  remove: deleteCategory,
  list: getAllCategories,
  find: getCategoryById,
  listForDocument: getCategoriesForDocument,
  listForDocumentHash: getCategoriesForDocumentByHash,
  setForDocument: setDocumentCategories,
  addToDocument: addCategoryToDocument,
  removeFromDocument: removeCategoryFromDocument,
  listColors: getCategoryColors,
  importFromFolders: importCategoriesFromFolders,
};

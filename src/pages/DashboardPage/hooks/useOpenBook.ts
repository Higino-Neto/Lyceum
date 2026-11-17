import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { openLibraryBook } from "../../../features/library/openLibraryBook";
import type { BookWithThumbnail } from "../../../types/LibraryTypes";
import { useTranslation } from "../../../i18n";

/** Opens a local library document (by id) in the reader. */
export function useOpenBook() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return useCallback(async (id: number) => {
    const book = (await window.api?.getBookById(id)) as BookWithThumbnail | null | undefined;
    if (!book) {
      toast.error(t("library:toasts.openFileFailed"));
      return;
    }
    await openLibraryBook(book, navigate);
  }, [navigate, t]);
}

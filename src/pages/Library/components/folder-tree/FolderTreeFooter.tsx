export default function FolderTreeFooter({
  folderCount,
  totalBooks,
}: {
  folderCount: number;
  totalBooks: number;
}) {
  return (
    <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
      <span>
        {folderCount} pasta{folderCount !== 1 ? "s" : ""} - {totalBooks} livro
        {totalBooks !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

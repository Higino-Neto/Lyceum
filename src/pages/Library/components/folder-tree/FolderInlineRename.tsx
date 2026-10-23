export default function FolderInlineRename({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onSubmit}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSubmit();
        if (event.key === "Escape") onCancel();
      }}
      className="flex-1 rounded-sm border border-border-strong bg-border-strong px-1.5 py-0.5 text-sm text-foreground focus:outline-none"
      autoFocus
      onClick={(event) => event.stopPropagation()}
    />
  );
}

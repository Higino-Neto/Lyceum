export default function AnnotationEmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-950/60 px-3 py-5 text-center text-xs text-zinc-500">
      {children}
    </div>
  );
}

export default function AnnotationEmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-sm border border-border bg-background/60 px-3 py-5 text-center text-xs text-foreground-subtle">
      {children}
    </div>
  );
}

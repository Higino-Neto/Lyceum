export default function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {item.dashed ? (
            <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <span className="inline-block h-2 w-2" style={{ background: item.color }} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

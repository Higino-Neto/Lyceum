type Props = {
  title: string;
  value: string;
  extraInfo?: string;
  subtitle?: string;
};

export default function StatCard({ title, value, subtitle, extraInfo }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-xl hover:border-zinc-700 transition">
      {value && (
        <>
          <p className="text-sm text-zinc-400">{title}</p>
          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-semibold mt-2 tracking-tight">
              {value}
            </h3>
            <a className="text-green-500 text-sm">{extraInfo}</a>
          </div>
          {subtitle && <p className="text-xs text-zinc-500 mt-2">{subtitle}</p>}
        </>
      )}
    </div>
  );
}

import { Lock, UserCircle } from "lucide-react";
import { hasSupabaseConfig } from "./supabaseMobile";

export default function MobileAccountGate({
  title,
  body,
  onOpenProfile,
}: {
  title: string;
  body: string;
  onOpenProfile: () => void;
}) {
  const configured = hasSupabaseConfig();

  return (
    <section className="grid min-h-[calc(100dvh-140px)] place-items-center p-5 text-center">
      <div className="w-full rounded border border-zinc-800 bg-zinc-900 p-5">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded bg-emerald-500/10 text-emerald-400">
          {configured ? <UserCircle size={24} /> : <Lock size={24} />}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-100">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
        <button
          className="mt-5 h-11 w-full rounded bg-emerald-600 text-sm font-semibold text-white"
          onClick={onOpenProfile}
          type="button"
        >
          {configured ? "Entrar na conta" : "Ver configuracao"}
        </button>
      </div>
    </section>
  );
}

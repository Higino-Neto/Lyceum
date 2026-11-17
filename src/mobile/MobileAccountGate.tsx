import { Lock, UserCircle } from "lucide-react";
import { hasSupabaseConfig } from "../lib/supabaseAuth";
import { useTranslation } from "../i18n";

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
  const { t } = useTranslation();

  return (
    <section className="grid min-h-[calc(100dvh-140px)] place-items-center p-5 text-center">
      <div className="w-full rounded border border-border bg-surface p-5">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded bg-primary-muted text-primary">
          {configured ? <UserCircle size={24} /> : <Lock size={24} />}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">{body}</p>
        <button
          className="mt-5 h-11 w-full rounded bg-primary text-sm font-semibold text-primary-foreground"
          onClick={onOpenProfile}
          type="button"
        >
          {configured ? t("mobile:account.signIn") : t("mobile:account.seeSetup")}
        </button>
      </div>
    </section>
  );
}

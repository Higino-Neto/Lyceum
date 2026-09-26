import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Send } from "lucide-react";
import toast from "react-hot-toast";
import {
  AuthField,
  AuthShell,
  authButtonClasses,
  authInputClasses,
} from "../components/auth/AuthShell";
import { requestPasswordReset } from "../utils/auth";
import { useTranslation } from "../i18n";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSentTo(email.trim());
      toast.success(t("auth:forgotPassword.sent"));
    } catch (error: any) {
      toast.error(error.message || t("auth:forgotPassword.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      icon={Mail}
      titleKey="auth:forgotPassword.title"
      subtitleKey="auth:forgotPassword.subtitle"
      footer={
        <Link
          to="/signin"
          className="inline-flex items-center gap-2 text-green-500 transition hover:text-green-400"
        >
          <ArrowLeft size={15} />
          {t("auth:forgotPassword.backToSignIn")}
        </Link>
      }
    >
      {sentTo ? (
        <div className="space-y-4">
          <div className="rounded border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">
            {t("auth:forgotPassword.message", { email: sentTo })}
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-zinc-700 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
            onClick={() => setSentTo("")}
          >
            {t("auth:forgotPassword.useAnotherEmail")}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label={t("auth:fields.email")}>
            <input
              type="email"
              placeholder={t("auth:fields.emailPlaceholder")}
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={authInputClasses}
            />
          </AuthField>

          <button type="submit" disabled={loading} className={authButtonClasses}>
            <Send size={17} />
            {loading
              ? t("auth:forgotPassword.submitting")
              : t("auth:forgotPassword.submit")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { AuthShell, authButtonClasses } from "../components/auth/AuthShell";
import { PasswordField } from "../components/auth/PasswordField";
import { PasswordRequirements } from "../components/auth/PasswordRequirements";
import {
  MIN_PASSWORD_LENGTH,
  updateAccountPassword,
  validatePasswordStrength,
} from "../utils/auth";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../i18n";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authErrorMessage, isLoading, session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error(t("auth:password.errors.mismatch"));
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      toast.error(t(passwordError.key, passwordError.values));
      return;
    }

    setLoading(true);
    try {
      await updateAccountPassword(password);
      toast.success(t("auth:resetPassword.success"));
      navigate("/signin", { replace: true });
    } catch (error: any) {
      toast.error(error.message || t("auth:resetPassword.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      icon={KeyRound}
      titleKey="auth:resetPassword.title"
      subtitleKey="auth:resetPassword.subtitle"
      footer={
        <Link
          to="/signin"
          className="inline-flex items-center gap-2 text-green-500 transition hover:text-green-400"
        >
          <ArrowLeft size={15} />
          {t("auth:resetPassword.backToSignIn")}
        </Link>
      }
    >
      {isLoading ? (
        <div className="h-32 animate-pulse rounded border border-zinc-800 bg-zinc-950/60" />
      ) : !session ? (
        <div className="space-y-4">
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            {authErrorMessage || t("auth:resetPassword.invalidLink")}
          </div>
          <Link
            to="/forgot-password"
            className="inline-flex h-10 w-full items-center justify-center rounded border border-zinc-700 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            {t("auth:resetPassword.requestNewLink")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label={t("auth:fields.newPassword")}
            placeholder={t("auth:fields.newPassword")}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={setPassword}
          />
          <PasswordField
            label={t("auth:fields.confirmPassword")}
            placeholder={t("auth:fields.confirmPassword")}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          <PasswordRequirements password={password} />
          <button type="submit" disabled={loading} className={authButtonClasses}>
            <Lock size={17} />
            {loading
              ? t("auth:resetPassword.submitting")
              : t("auth:resetPassword.submit")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

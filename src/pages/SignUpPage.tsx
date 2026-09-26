import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MailCheck, RotateCcw, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import {
  AuthField,
  AuthShell,
  authButtonClasses,
  authInputClasses,
} from "../components/auth/AuthShell";
import { PasswordField } from "../components/auth/PasswordField";
import { PasswordRequirements } from "../components/auth/PasswordRequirements";
import {
  MIN_PASSWORD_LENGTH,
  resendSignupConfirmation,
  signUp,
  validatePasswordStrength,
} from "../utils/auth";
import { useTranslation } from "../i18n";

export default function SignUp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

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
      const result = await signUp(email, password, name);
      if (result.error) {
        toast.error(result.error.message || t("auth:signUp.error"));
      } else if (result.needsEmailConfirmation) {
        setConfirmationEmail(email.trim());
        toast.success(t("auth:signUp.confirmation.sent"));
      } else {
        toast.success(t("auth:signUp.created"));
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || t("auth:signUp.error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    setResending(true);
    try {
      await resendSignupConfirmation(confirmationEmail);
      toast.success(t("auth:signUp.confirmation.resent"));
    } catch (error: any) {
      toast.error(error.message || t("auth:signUp.confirmation.resendError"));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      icon={confirmationEmail ? MailCheck : UserPlus}
      titleKey={
        confirmationEmail
          ? "auth:signUp.confirmation.title"
          : "auth:signUp.title"
      }
      subtitleKey={
        confirmationEmail
          ? "auth:signUp.confirmation.subtitle"
          : "auth:signUp.subtitle"
      }
      footer={
        <>
          {t("auth:signUp.hasAccount")}{" "}
          <Link to="/signin" className="text-green-500 transition hover:text-green-400">
            {t("auth:signUp.signIn")}
          </Link>
        </>
      }
    >
      {confirmationEmail ? (
        <div className="space-y-4">
          <div className="rounded border border-green-500/30 bg-green-500/10 p-4 text-sm leading-6 text-green-100">
            {t("auth:signUp.confirmation.message", { email: confirmationEmail })}
          </div>
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={resending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-zinc-700 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={16} />
            {resending
              ? t("auth:signUp.confirmation.resending")
              : t("auth:signUp.confirmation.resend")}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label={t("auth:fields.name")}>
            <input
              type="text"
              placeholder={t("auth:fields.namePlaceholder")}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={authInputClasses}
            />
          </AuthField>

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

          <PasswordField
            label={t("auth:fields.password")}
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
            {loading ? t("auth:signUp.submitting") : t("auth:signUp.submit")}
            <ArrowRight size={17} />
          </button>
        </form>
      )}
    </AuthShell>
  );
}

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

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { isLoading, session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setLoading(true);
    try {
      await updateAccountPassword(password);
      toast.success("Senha redefinida com sucesso.");
      navigate("/signin", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Não foi possível redefinir a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      icon={KeyRound}
      title="Definir nova senha"
      subtitle="Crie uma senha forte para voltar ao Lyceum."
      footer={
        <Link
          to="/signin"
          className="inline-flex items-center gap-2 text-green-500 transition hover:text-green-400"
        >
          <ArrowLeft size={15} />
          Voltar para o login
        </Link>
      }
    >
      {isLoading ? (
        <div className="h-32 animate-pulse rounded border border-zinc-800 bg-zinc-950/60" />
      ) : !session ? (
        <div className="space-y-4">
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            O link de recuperação está ausente ou expirou. Solicite um novo
            email para redefinir a senha.
          </div>
          <Link
            to="/forgot-password"
            className="inline-flex h-10 w-full items-center justify-center rounded border border-zinc-700 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Solicitar novo link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="Nova senha"
            placeholder="Nova senha"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={setPassword}
          />
          <PasswordField
            label="Confirmar senha"
            placeholder="Confirmar senha"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          <PasswordRequirements password={password} />
          <button type="submit" disabled={loading} className={authButtonClasses}>
            <Lock size={17} />
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

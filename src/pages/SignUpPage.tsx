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

export default function SignUp() {
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
      const result = await signUp(email, password, name);
      if (result.error) {
        toast.error(result.error.message || "Falha ao criar conta");
      } else if (result.needsEmailConfirmation) {
        setConfirmationEmail(email.trim());
        toast.success("Enviamos um email de confirmação.");
      } else {
        toast.success("Conta criada com sucesso.");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    setResending(true);
    try {
      await resendSignupConfirmation(confirmationEmail);
      toast.success("Email de confirmação reenviado.");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível reenviar o email");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      icon={confirmationEmail ? MailCheck : UserPlus}
      title={confirmationEmail ? "Confirme seu email" : "Criar conta"}
      subtitle={
        confirmationEmail
          ? "Finalize o cadastro pelo link enviado para sua caixa de entrada."
          : "Crie uma conta para sincronizar leitura, biblioteca e preferências."
      }
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/signin" className="text-green-500 transition hover:text-green-400">
            Entrar
          </Link>
        </>
      }
    >
      {confirmationEmail ? (
        <div className="space-y-4">
          <div className="rounded border border-green-500/30 bg-green-500/10 p-4 text-sm leading-6 text-green-100">
            Enviamos a confirmação para{" "}
            <span className="font-medium">{confirmationEmail}</span>. Depois de
            confirmar, volte ao login para entrar.
          </div>
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={resending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-zinc-700 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={16} />
            {resending ? "Reenviando..." : "Reenviar confirmação"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label="Nome">
            <input
              type="text"
              placeholder="Seu nome"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={authInputClasses}
            />
          </AuthField>

          <AuthField label="Email">
            <input
              type="email"
              placeholder="voce@exemplo.com"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={authInputClasses}
            />
          </AuthField>

          <PasswordField
            label="Senha"
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
            {loading ? "Criando conta..." : "Criar conta"}
            <ArrowRight size={17} />
          </button>
        </form>
      )}
    </AuthShell>
  );
}

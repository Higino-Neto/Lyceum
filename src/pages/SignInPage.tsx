import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LogIn, Mail } from "lucide-react";
import toast from "react-hot-toast";
import {
  AuthField,
  AuthShell,
  authButtonClasses,
  authInputClasses,
} from "../components/auth/AuthShell";
import { PasswordField } from "../components/auth/PasswordField";
import { signIn } from "../utils/auth";

interface LocationState {
  from?: string;
}

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Login realizado com sucesso.");
      const redirectTo = (location.state as LocationState | null)?.from || "/";
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Falha ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      icon={LogIn}
      title="Entrar"
      subtitle="Acesse sua biblioteca, backups e estatísticas de leitura."
      footer={
        <>
          Não tem conta?{" "}
          <Link to="/signup" className="text-green-500 transition hover:text-green-400">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="Email">
          <div className="relative">
            <Mail
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
            />
            <input
              type="email"
              placeholder="voce@exemplo.com"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`${authInputClasses} pl-10`}
            />
          </div>
        </AuthField>

        <div className="space-y-2">
          <PasswordField
            label="Senha"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-green-500 transition hover:text-green-400"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        <button type="submit" disabled={loading} className={authButtonClasses}>
          {loading ? "Entrando..." : "Entrar"}
          <ArrowRight size={17} />
        </button>
      </form>
    </AuthShell>
  );
}

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSentTo(email.trim());
      toast.success("Email de recuperação enviado.");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível enviar a recuperação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      icon={Mail}
      title="Recuperar senha"
      subtitle="Informe o email da sua conta para receber um link de redefinição."
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
      {sentTo ? (
        <div className="space-y-4">
          <div className="rounded border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">
            Se uma conta existir para <span className="font-medium">{sentTo}</span>,
            enviaremos as instruções de recuperação.
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-zinc-700 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
            onClick={() => setSentTo("")}
          >
            Usar outro email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button type="submit" disabled={loading} className={authButtonClasses}>
            <Send size={17} />
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

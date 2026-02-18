import { useNavigate, Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { signUp } from "../utils/auth";

export default function SignUp() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("As senhas não coincidem");
      return;
    }

    await signUp(email, password);

    navigate("/");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-2">
          <UserPlus className="text-green-500" size={22} />
          <h1 className="text-xl font-semibold">Criar conta</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 outline-none focus:border-green-500"
          />

          <input
            type="password"
            placeholder="Senha"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 outline-none focus:border-green-500"
          />

          <input
            type="password"
            placeholder="Confirmar senha"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 outline-none focus:border-green-500"
          />

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-500 transition py-2.5 rounded-lg font-medium text-black"
          >
            Criar conta
          </button>
        </form>

        <p className="text-sm text-zinc-400 text-center">
          Já tem conta?{" "}
          <Link to="/signin" className="text-green-500 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

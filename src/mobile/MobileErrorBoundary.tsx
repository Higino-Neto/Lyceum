import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export default class MobileErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[mobile] unrecoverable render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-zinc-950 p-6 text-zinc-100">
        <section className="w-full max-w-sm rounded-xl border border-red-500/30 bg-zinc-900 p-5 text-center" role="alert">
          <h1 className="text-lg font-semibold">O Lyceum encontrou um erro inesperado</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Seus livros continuam salvos no aparelho. Reinicie esta tela para recuperar o aplicativo.
          </p>
          <button
            className="mt-5 h-11 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reiniciar aplicativo
          </button>
        </section>
      </main>
    );
  }
}

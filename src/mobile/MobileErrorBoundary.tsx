import { Component, type ErrorInfo, type ReactNode } from "react";
import { translate } from "../i18n";

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
      <main className="grid min-h-[100dvh] place-items-center bg-background p-6 text-foreground">
        <section className="w-full max-w-sm rounded-xl border border-destructive/30 bg-surface p-5 text-center" role="alert">
          <h1 className="text-lg font-semibold">{translate("mobile:errorBoundary.title")}</h1>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">
            {translate("mobile:errorBoundary.body")}
          </p>
          <button
            className="mt-5 h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            onClick={() => window.location.reload()}
            type="button"
          >
            {translate("mobile:errorBoundary.restart")}
          </button>
        </section>
      </main>
    );
  }
}

import { Component, type ErrorInfo, type ReactNode } from "react";
import { translate } from "../i18n";

interface DiagnosticsApi {
  reportRendererError?: (input: { message: string; stack?: string | null; componentStack?: string | null; source?: string | null; route?: string | null }) => Promise<unknown>;
  openLogs?: () => Promise<{ success: boolean; error?: string }>;
}

function diagnostics(): DiagnosticsApi {
  return (typeof window !== "undefined" ? (window.api as unknown as DiagnosticsApi) : undefined) || {};
}

/** Sends a renderer error to the main-process log (best effort). */
export function reportRendererError(error: unknown, extra: { componentStack?: string | null; source?: string } = {}) {
  const asError = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  try {
    void diagnostics().reportRendererError?.({
      message: asError.message || asError.name || "Erro",
      stack: asError.stack || null,
      componentStack: extra.componentStack || null,
      source: extra.source || null,
      route: typeof window !== "undefined" ? window.location.hash || window.location.pathname : null,
    })?.catch?.(() => undefined);
  } catch {
    // Reporting must never throw from an error handler.
  }
}

let globalHandlersInstalled = false;

/** Logs errors that escape React (event handlers, async code). */
export function installGlobalErrorReporting() {
  if (globalHandlersInstalled || typeof window === "undefined") return;
  globalHandlersInstalled = true;
  window.addEventListener("error", (event) => reportRendererError(event.error || event.message, { source: "window.onerror" }));
  window.addEventListener("unhandledrejection", (event) => reportRendererError(event.reason, { source: "unhandledrejection" }));
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** "app": full-screen fallback. "page": fallback inside the content area. */
  variant?: "app" | "page";
  /** Changing this value clears the error (e.g. the current route). */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey?: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    // Navigating to another page recovers from a page-level error.
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.variant || "app"}]`, error, info.componentStack);
    reportRendererError(error, { componentStack: info.componentStack, source: `error-boundary:${this.props.variant || "app"}` });
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const page = this.props.variant === "page";
    const openLogs = diagnostics().openLogs;
    return (
      <div className={page ? "grid h-full place-items-center p-6" : "grid min-h-screen place-items-center bg-background p-6 text-foreground"}>
        <section className="w-full max-w-md rounded-sm border border-destructive/30 bg-surface p-5 text-center" role="alert">
          <h1 className="text-lg font-semibold text-foreground">{translate("common:errorBoundary.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">
            {page ? translate("common:errorBoundary.pageBody") : translate("common:errorBoundary.appBody")}
          </p>
          <pre className="mt-3 max-h-28 overflow-auto rounded-sm bg-background p-2 text-left text-[11px] text-foreground-subtle">{error.message}</pre>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {page && (
              <button type="button" onClick={this.retry} className="h-9 rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
                {translate("common:errorBoundary.retry")}
              </button>
            )}
            <button type="button" onClick={() => window.location.reload()} className={page ? "h-9 rounded-sm border border-border-strong bg-surface px-3 text-sm text-foreground hover:bg-surface-muted" : "h-9 rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"}>
              {translate("common:errorBoundary.reload")}
            </button>
            {openLogs && (
              <button type="button" onClick={() => void openLogs()} className="h-9 rounded-sm border border-border bg-background px-3 text-sm text-foreground hover:bg-surface-muted">
                {translate("common:errorBoundary.openLogs")}
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }
}

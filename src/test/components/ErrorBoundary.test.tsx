import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "../../components/ErrorBoundary";

function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error("falha na tela");
  return <p>conteudo ok</p>;
}

describe("ErrorBoundary", () => {
  const reportRendererError = vi.fn().mockResolvedValue({ success: true });
  const openLogs = vi.fn().mockResolvedValue({ success: true });
  let consoleError: typeof console.error;

  beforeEach(() => {
    consoleError = console.error;
    console.error = vi.fn();
    Object.defineProperty(window, "api", { value: { reportRendererError, openLogs }, configurable: true, writable: true });
  });
  afterEach(() => {
    console.error = consoleError;
    reportRendererError.mockClear();
  });

  it("shows a page fallback, reports the error and recovers when the route changes", () => {
    const { rerender } = render(<ErrorBoundary variant="page" resetKey="/library"><Boom explode /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("falha na tela");
    expect(reportRendererError).toHaveBeenCalledWith(expect.objectContaining({
      message: "falha na tela",
      source: "error-boundary:page",
      componentStack: expect.any(String),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Abrir logs" }));
    expect(openLogs).toHaveBeenCalled();

    rerender(<ErrorBoundary variant="page" resetKey="/reading"><Boom explode={false} /></ErrorBoundary>);
    expect(screen.getByText("conteudo ok")).toBeInTheDocument();
  });

  it("retries in place on a page error", () => {
    let explode = true;
    function Flaky() {
      if (explode) throw new Error("uma vez");
      return <p>recuperado</p>;
    }
    render(<ErrorBoundary variant="page" resetKey="/x"><Flaky /></ErrorBoundary>);
    explode = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(screen.getByText("recuperado")).toBeInTheDocument();
  });
});

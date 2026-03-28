import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "../../components/ProtectedRoute";

describe("ProtectedRoute", () => {
  const testChild = <div data-testid="child-content">Protected Content</div>;

  it("shows loading spinner when isLoggedIn is null", () => {
    render(
      <ProtectedRoute isLoggedIn={null}>
        {testChild}
      </ProtectedRoute>
    );
    
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
  });

  it("redirects to signup when not logged in", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/protected"]}>
        <ProtectedRoute isLoggedIn={false}>
          {testChild}
        </ProtectedRoute>
      </MemoryRouter>
    );
    
    expect(container.querySelector("[data-testid='child-content']")).not.toBeInTheDocument();
  });

  it("renders children when logged in", () => {
    render(
      <ProtectedRoute isLoggedIn={true}>
        {testChild}
      </ProtectedRoute>
    );
    
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("has correct loading styling", () => {
    const { container } = render(
      <ProtectedRoute isLoggedIn={null}>
        {testChild}
      </ProtectedRoute>
    );
    
    const loader = container.firstChild as HTMLElement;
    expect(loader).toHaveClass("h-screen", "bg-zinc-950", "flex", "items-center", "justify-center");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../../components/ProtectedRoute";

describe("ProtectedRoute", () => {
  const testChild = <div data-testid="child-content">Protected Content</div>;

  it("shows loading spinner when isLoggedIn is null", () => {
    render(
      <MemoryRouter>
        <ProtectedRoute isLoggedIn={null}>
          {testChild}
        </ProtectedRoute>
      </MemoryRouter>,
    );
    
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
  });

  it("redirects to signin when not logged in", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute isLoggedIn={false}>
                {testChild}
              </ProtectedRoute>
            }
          />
          <Route path="/signin" element={<div>Signin page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Signin page")).toBeInTheDocument();
    expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
  });

  it("renders children when logged in", () => {
    render(
      <MemoryRouter>
        <ProtectedRoute isLoggedIn={true}>
          {testChild}
        </ProtectedRoute>
      </MemoryRouter>,
    );
    
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("has correct loading styling", () => {
    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute isLoggedIn={null}>
          {testChild}
        </ProtectedRoute>
      </MemoryRouter>,
    );
    
    const loader = container.firstChild as HTMLElement;
    expect(loader).toHaveClass("h-screen", "bg-zinc-950", "flex", "items-center", "justify-center");
  });
});

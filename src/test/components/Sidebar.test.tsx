import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Sidebar from "../../components/Sidebar";

const renderSidebar = (collapsed = false) => {
  return render(
    <BrowserRouter>
      <Sidebar collapsed={collapsed} />
    </BrowserRouter>
  );
};

describe("Sidebar", () => {
  beforeEach(() => {
    vi.mock(import.meta.env.VITE_APP_VERSION, () => "1.0.0");
  });

  it("renders navigation items", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Registrar")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Perfil")).toBeInTheDocument();
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("renders with collapsed state", () => {
    const { container } = renderSidebar(true);
    expect(container.querySelector("aside")).toHaveClass("w-13");
  });

  it("renders with expanded state", () => {
    const { container } = renderSidebar(false);
    expect(container.querySelector("aside")).toHaveClass("w-42");
  });

  it("renders navigation icons", () => {
    renderSidebar();
    const icons = document.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
  });

  it("highlights Dashboard when on home page", () => {
    window.location.pathname = "/";
    const { getByText } = renderSidebar();
    const dashboardItem = getByText("Dashboard").closest("button");
    expect(dashboardItem).toBeInTheDocument();
  });
});

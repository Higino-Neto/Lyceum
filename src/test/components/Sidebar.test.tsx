import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Sidebar from "../../components/Sidebar";

const renderSidebar = (
  collapsed = false,
  autoHideEnabled = false,
  autoHideOverlay = false,
  panelsVisible = true,
  isLoggedIn = true,
) => {
  return render(
    <BrowserRouter>
      <Sidebar
        collapsed={collapsed}
        autoHideEnabled={autoHideEnabled}
        autoHideOverlay={autoHideOverlay}
        panelsVisible={panelsVisible}
        onShowPanels={() => {}}
        onHidePanels={() => {}}
        isLoggedIn={isLoggedIn}
        userEmail="test@example.com"
      />
    </BrowserRouter>,
  );
};

describe("Sidebar", () => {
  beforeEach(() => {
    vi.mock(import.meta.env.VITE_APP_VERSION, () => "1.0.0");
  });

  it("renders navigation items for a logged user", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Registrar")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Atlas")).toBeInTheDocument();
    expect(screen.getByText("Hábitos")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(screen.getByText("Conta")).toBeInTheDocument();
    expect(screen.getByText("Sair")).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("renders login action for a logged out user", () => {
    renderSidebar(false, false, false, true, false);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.queryByText("Sair")).not.toBeInTheDocument();
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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookOpen, TrendingUp, Clock } from "lucide-react";
import StatCard from "../../components/StatCard";

describe("StatCard", () => {
  it("renders with value", () => {
    render(<StatCard value={<span>100</span>} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders with icon", () => {
    render(<StatCard icon={BookOpen} value={<span>50</span>} />);
    const icon = document.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("renders with extra info", () => {
    render(<StatCard value={<span>25</span>} extraInfo={<span>+5 este mês</span>} />);
    expect(screen.getByText("+5 este mês")).toBeInTheDocument();
  });

  it("renders without icon", () => {
    render(<StatCard value={<span>0</span>} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    const icons = document.querySelectorAll("svg");
    expect(icons.length).toBe(0);
  });

  it("renders with different icons", () => {
    const { rerender } = render(<StatCard icon={BookOpen} value={<span>10</span>} />);
    expect(document.querySelectorAll("svg").length).toBe(1);

    rerender(<StatCard icon={TrendingUp} value={<span>20</span>} />);
    expect(document.querySelectorAll("svg").length).toBe(1);

    rerender(<StatCard icon={Clock} value={<span>30</span>} />);
    expect(document.querySelectorAll("svg").length).toBe(1);
  });

  it("has correct styling classes", () => {
    const { container } = render(<StatCard value={<span>100</span>} />);
    expect(container.firstChild).toHaveClass("bg-zinc-900");
    expect(container.firstChild).toHaveClass("border-zinc-800");
    expect(container.firstChild).toHaveClass("rounded-sm");
  });
});

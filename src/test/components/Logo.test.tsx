import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Logo } from "../../components/Logo";

describe("Logo", () => {
  it("renders the SVG", () => {
    render(<Logo />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders with default size", () => {
    render(<Logo />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("width", "120");
    expect(svg).toHaveAttribute("height", "120");
  });

  it("renders with custom size", () => {
    render(<Logo size={200} />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("width", "200");
    expect(svg).toHaveAttribute("height", "200");
  });

  it("renders with color variant", () => {
    render(<Logo variant="color" />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders with dark variant", () => {
    render(<Logo variant="dark" />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders with light variant", () => {
    render(<Logo variant="light" />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Logo className="custom-class" />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
  });
});

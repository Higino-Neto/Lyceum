import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmDialog from "../../components/ConfirmDialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    isOpen: true,
    title: "Test Dialog",
    message: "Are you sure?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders title and message when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("renders default confirm button text", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Confirmar")).toBeInTheDocument();
  });

  it("renders custom confirm button text", () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Delete" />);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders default cancel button text", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
  });

  it("renders custom cancel button text", () => {
    render(<ConfirmDialog {...defaultProps} cancelLabel="No" />);
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    
    fireEvent.click(screen.getByText("Confirmar"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when X button is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    
    const closeButton = document.querySelector("button");
    if (closeButton) {
      fireEvent.click(closeButton);
    }
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows danger styling when isDanger is true", () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} isDanger />
    );
    const confirmButton = screen.getByText("Confirmar");
    expect(confirmButton).toHaveClass("bg-red-500");
  });

  it("shows warning icon when isDanger is true", () => {
    render(<ConfirmDialog {...defaultProps} isDanger />);
    const alertIcon = document.querySelector("svg");
    expect(alertIcon).toBeInTheDocument();
  });

  it("does not show warning icon when isDanger is false", () => {
    const { container } = render(<ConfirmDialog {...defaultProps} />);
    const alertIcons = container.querySelectorAll(".text-red-400");
    expect(alertIcons.length).toBe(0);
  });

  it("has correct styling classes", () => {
    const { container } = render(<ConfirmDialog {...defaultProps} />);
    const dialog = container.firstChild as HTMLElement;
    expect(dialog).toHaveClass("fixed", "inset-0", "bg-black/50");
  });
});

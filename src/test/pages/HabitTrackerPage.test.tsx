import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import HabitTrackerPage from "../../pages/HabitTrackerPage/HabitTrackerPage";
import { renderWithBasicProviders } from "../helpers/renderWithProviders";

describe("HabitTrackerPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates and renders a new habit", () => {
    renderWithBasicProviders(<HabitTrackerPage />);

    fireEvent.change(screen.getByLabelText(/Nome do hábito/i), {
      target: { value: "Ler 20 páginas" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Adicionar hábito/i }));

    expect(screen.getByText("Ler 20 páginas")).toBeInTheDocument();
  });

  it("toggles a day completion and persists it", () => {
    renderWithBasicProviders(<HabitTrackerPage />);

    fireEvent.change(screen.getByLabelText(/Nome do hábito/i), {
      target: { value: "Meditar" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar hábito/i }));

    const firstDayButton = screen.getAllByRole("button", {
      name: /Meditar - dia \d+/i,
    })[0];

    fireEvent.click(firstDayButton);

    expect(firstDayButton).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("lyceum_habit_tracker")).toContain(
      "Meditar"
    );
  });

  it("removes a habit and its stored completions", () => {
    renderWithBasicProviders(<HabitTrackerPage />);

    fireEvent.change(screen.getByLabelText(/Nome do hábito/i), {
      target: { value: "Escrever" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar hábito/i }));

    const firstDayButton = screen.getAllByRole("button", {
      name: /Escrever - dia \d+/i,
    })[0];
    fireEvent.click(firstDayButton);
    fireEvent.click(
      screen.getByRole("button", { name: /Excluir h.bito Escrever/i })
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(screen.queryByText("Escrever")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("lyceum_habit_tracker")).not.toContain(
      "Escrever"
    );
  });

  it("reorders habits with drag and drop", () => {
    renderWithBasicProviders(<HabitTrackerPage />);

    fireEvent.change(screen.getByLabelText(/Nome do hábito/i), {
      target: { value: "Alongar" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar hábito/i }));

    fireEvent.change(screen.getByLabelText(/Nome do hábito/i), {
      target: { value: "Estudar" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar hábito/i }));

    const dragHandle = screen.getByRole("button", {
      name: /Reordenar h.bito Estudar/i,
    });
    const dropTarget = screen.getByText("Alongar").closest("div");

    fireEvent.dragStart(dragHandle);
    fireEvent.dragEnter(dropTarget!);
    fireEvent.drop(dropTarget!);
    fireEvent.dragEnd(dragHandle);

    const habitNames = screen.getAllByRole("heading", { level: 3 });
    expect(habitNames[0]).toHaveTextContent("Estudar");
    expect(habitNames[1]).toHaveTextContent("Alongar");
  });

  it("creates a measurable habit with unit and stores a numeric value", () => {
    renderWithBasicProviders(<HabitTrackerPage />);

    fireEvent.change(screen.getByLabelText(/Nome do hábito/i), {
      target: { value: "Estudar" },
    });
    fireEvent.click(screen.getByLabelText(/Mensurar/i));
    fireEvent.change(screen.getByLabelText(/Unidade de medida/i), {
      target: { value: "Horas" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar hábito/i }));

    expect(screen.getByText("Estudar (Horas)")).toBeInTheDocument();

    const firstDayButton = screen.getAllByRole("button", {
      name: /Estudar \(Horas\) - dia \d+/i,
    })[0];

    fireEvent.click(firstDayButton);

    const measureInput = screen.getByRole("textbox", {
      name: /Estudar \(Horas\) - dia \d+ - valor/i,
    });

    fireEvent.change(measureInput, {
      target: { value: "2" },
    });
    fireEvent.keyDown(measureInput, { key: "Enter" });

    expect(
      screen.getAllByRole("button", {
        name: /Estudar \(Horas\) - dia \d+/i,
      })[0]
    ).toHaveTextContent("2");

    const savedState = JSON.parse(
      window.localStorage.getItem("lyceum_habit_tracker") ?? "{}"
    );

    expect(savedState.habits[0]).toMatchObject({
      name: "Estudar",
      unit: "Horas",
      valueMode: "measure",
    });
    expect(
      Object.values(savedState.completions[savedState.habits[0].id])
    ).toContain(2);
  });

  it("renders when persisted tracker data uses the old object format", () => {
    window.localStorage.setItem(
      "lyceum_habit_tracker",
      JSON.stringify({
        habits: [
          {
            id: "habit-1",
            name: "Meditar",
            createdAt: new Date().toISOString(),
            unit: "yn",
            valueMode: "toggle",
          },
        ],
        completions: {
          "habit-1": {
            "2026-04-01": true,
            "2026-04-02": 3,
          },
        },
      })
    );

    renderWithBasicProviders(<HabitTrackerPage />);

    expect(screen.getByText("Meditar")).toBeInTheDocument();
  });
});

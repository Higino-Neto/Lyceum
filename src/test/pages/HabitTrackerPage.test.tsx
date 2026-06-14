import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HabitTrackerPage from "../../pages/HabitTrackerPage/HabitTrackerPage";
import { renderWithBasicProviders } from "../helpers/renderWithProviders";

const originalWindowApi = window.api;

const mockHabitApi = {
  habitsGetAll: vi.fn().mockResolvedValue([]),
  habitsGetAllCompletions: vi.fn().mockResolvedValue([]),
  habitsAdd: vi.fn().mockResolvedValue(undefined),
  habitsUpdate: vi.fn().mockResolvedValue(undefined),
  habitsDelete: vi.fn().mockResolvedValue(undefined),
  habitsSetCompletion: vi.fn().mockResolvedValue(undefined),
  habitsDeleteCompletion: vi.fn().mockResolvedValue(undefined),
};

async function renderHabitTrackerPage() {
  renderWithBasicProviders(<HabitTrackerPage />);
  await waitFor(() => {
    expect(mockHabitApi.habitsGetAllCompletions).toHaveBeenCalled();
  });
}

function submitHabit(name: string) {
  const nameInput = screen.getByRole("textbox", { name: /Nome do h.bito/i });
  fireEvent.change(nameInput, { target: { value: name } });
  expect(nameInput).toHaveValue(name);
  fireEvent.submit(nameInput.closest("form")!);
}

describe("HabitTrackerPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "api", {
      value: mockHabitApi,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "api", {
      value: originalWindowApi,
      writable: true,
      configurable: true,
    });
  });

  it("creates and renders a new habit", async () => {
    await renderHabitTrackerPage();

    submitHabit("Ler 20 paginas");

    expect(await screen.findByText("Ler 20 paginas")).toBeInTheDocument();
    expect(mockHabitApi.habitsAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ler 20 paginas" })
    );
  });

  it("toggles a day completion and persists it", async () => {
    await renderHabitTrackerPage();

    submitHabit("Meditar");

    await screen.findByText("Meditar");

    const firstDayButton = screen.getAllByRole("button", {
      name: /Meditar - dia \d+/i,
    })[0];

    fireEvent.click(firstDayButton);

    await waitFor(() => {
      expect(firstDayButton).toHaveAttribute("aria-pressed", "true");
    });
    expect(mockHabitApi.habitsSetCompletion).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "true"
    );
  });

  it("removes a habit and its stored completions", async () => {
    await renderHabitTrackerPage();

    submitHabit("Escrever");

    await screen.findByText("Escrever");

    const firstDayButton = screen.getAllByRole("button", {
      name: /Escrever - dia \d+/i,
    })[0];
    fireEvent.click(firstDayButton);
    fireEvent.click(
      screen.getByRole("button", { name: /Excluir h.bito Escrever/i })
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(screen.queryByText("Escrever")).not.toBeInTheDocument();
    });
    expect(mockHabitApi.habitsDelete).toHaveBeenCalledWith(expect.any(String));
  });

  it("reorders habits with drag and drop", async () => {
    await renderHabitTrackerPage();

    submitHabit("Alongar");
    await screen.findByText("Alongar");

    submitHabit("Estudar");
    await screen.findByText("Estudar");

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

  it("creates a measurable habit with unit and stores a numeric value", async () => {
    await renderHabitTrackerPage();

    const nameInput = screen.getByRole("textbox", { name: /Nome do h.bito/i });
    fireEvent.change(nameInput, { target: { value: "Estudar" } });
    fireEvent.click(screen.getByLabelText(/Mensurar/i));
    fireEvent.change(screen.getByLabelText(/Unidade de medida/i), {
      target: { value: "Horas" },
    });
    fireEvent.submit(nameInput.closest("form")!);

    expect(await screen.findByText("Estudar (Horas)")).toBeInTheDocument();

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

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", {
          name: /Estudar \(Horas\) - dia \d+/i,
        })[0]
      ).toHaveTextContent("2");
    });

    expect(mockHabitApi.habitsAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Estudar",
        unit: "Horas",
        valueMode: "measure",
      })
    );
    expect(mockHabitApi.habitsSetCompletion).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "2"
    );
  });

  it("renders persisted tracker data loaded from the app API", async () => {
    mockHabitApi.habitsGetAll.mockResolvedValueOnce([
      {
        id: "habit-1",
        name: "Meditar",
        createdAt: new Date().toISOString(),
        unit: "yn",
        valueMode: "toggle",
      },
    ]);
    mockHabitApi.habitsGetAllCompletions.mockResolvedValueOnce([
      { habitId: "habit-1", dateKey: "2026-04-01", value: null },
      { habitId: "habit-1", dateKey: "2026-04-02", value: "3" },
    ]);

    renderWithBasicProviders(<HabitTrackerPage />);

    expect(await screen.findByText("Meditar")).toBeInTheDocument();
  });
});

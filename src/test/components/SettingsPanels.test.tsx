import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LibrarySettingsPanel } from "../../components/settings/SettingsPanels";
import { AppSettingsProvider } from "../../contexts/AppSettingsContext";

describe("LibrarySettingsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles and persists unified library view", async () => {
    render(
      <AppSettingsProvider>
        <LibrarySettingsPanel />
      </AppSettingsProvider>,
    );

    const toggle = screen.getByRole("button", {
      name: /exibi/i,
    });

    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("lyceum:app-settings") || "{}")).toMatchObject({
        unifiedLibraryView: true,
      });
    });
  });
});

import { afterEach, describe, expect, it } from "vitest";
import i18next from "i18next";
import { translateConversionMessage } from "../features/conversion/conversionMessages";

describe("conversion message translation", () => {
  afterEach(async () => {
    await i18next.changeLanguage("pt-BR");
  });

  it("translates pipeline warnings with captured values", async () => {
    await i18next.changeLanguage("en");
    expect(translateConversionMessage("Imagem não encontrada: OEBPS/img/a.png")).toBe("Image not found: OEBPS/img/a.png");
    expect(translateConversionMessage("12 caractere(s) foram substituídos por falta de suporte da fonte PDF."))
      .toBe("12 character(s) were replaced because the PDF font does not support them.");
  });

  it("keeps a book-title prefix and leaves unknown messages untouched", async () => {
    await i18next.changeLanguage("en");
    expect(translateConversionMessage("Dom Casmurro: Capitulo nao encontrado: ch1.xhtml")).toBe("Dom Casmurro: Chapter not found: ch1.xhtml");
    expect(translateConversionMessage("Something else")).toBe("Something else");
  });
});

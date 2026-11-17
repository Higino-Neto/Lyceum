import type { IpcMain } from "electron";
import type { LearningDocumentLexicon, StatsRepository } from "../infrastructure/sqlite-stats-repository";
import { nonEmptyString } from "../ipc/validation";

export interface StatsHandlerDependencies {
  repository: StatsRepository;
  /** Lexicons of analysed learning documents (for per-book coverage). */
  learningDocuments(): LearningDocumentLexicon[];
}

export function registerStatsHandlers(ipcMain: IpcMain, dependencies: StatsHandlerDependencies) {
  ipcMain.handle("stats:library-summary", () => dependencies.repository.librarySummary());

  ipcMain.handle("stats:language-summary", (_, rawUser: unknown) =>
    dependencies.repository.languageSummary(
      nonEmptyString(rawUser, "userId", 200),
      dependencies.learningDocuments(),
    ));
}

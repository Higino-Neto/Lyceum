import type { ExerciseAnalysis } from "../core/pdf/exercise-detection";

// Reading the whole text layer is expensive: keep results for the session and
// share in-flight requests between the PDF Builder and the reader.
const cache = new Map<string, ExerciseAnalysis>();
const pending = new Map<string, Promise<ExerciseAnalysis>>();
let jobCounter = 0;

export function cachedExerciseAnalysis(filePath: string): ExerciseAnalysis | null {
  return cache.get(filePath) ?? null;
}

export function analyzePdfExercises(
  filePath: string,
  onProgress?: (progress: number, message?: string) => void,
): Promise<ExerciseAnalysis> {
  const cached = cache.get(filePath);
  if (cached) return Promise.resolve(cached);
  const jobId = `exercises-${Date.now().toString(36)}-${++jobCounter}`;
  const unsubscribe = onProgress && window.api.onToolProgress
    ? window.api.onToolProgress((event) => { if (event.jobId === jobId) onProgress(event.progress, event.message); })
    : undefined;
  let request = pending.get(filePath);
  if (!request) {
    request = window.api.analyzeToolPdfExercises(filePath, jobId).then((result) => {
      if (!result.success || !result.analysis) throw new Error(result.error || "");
      cache.set(filePath, result.analysis);
      return result.analysis;
    }).finally(() => pending.delete(filePath));
    pending.set(filePath, request);
  }
  return request.finally(() => unsubscribe?.());
}

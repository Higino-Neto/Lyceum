/**
 * Speech provider abstraction. The bundled provider uses the platform's Web
 * Speech synthesis; it reports itself unavailable when the OS has no voice
 * for the language instead of reading with a wrong voice.
 */
export interface SpeakOptions {
  lang: string;
  rate: number;
  onBoundary?: (charIndex: number) => void;
}

export interface SpeechProvider {
  id: string;
  hasVoice(lang: string): Promise<boolean>;
  speak(text: string, options: SpeakOptions): Promise<void>;
  pause(): void;
  resume(): void;
  cancel(): void;
}

function synthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const engine = synthesis();
  if (!engine) return Promise.resolve([]);
  const voices = engine.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => {
      engine.removeEventListener("voiceschanged", done);
      clearTimeout(timer);
      resolve(engine.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    engine.addEventListener("voiceschanged", done);
  });
}

export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const wanted = lang.toLowerCase();
  const base = wanted.split("-")[0] ?? wanted;
  return voices.find((voice) => voice.lang.toLowerCase() === wanted)
    ?? voices.find((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === base)
    ?? null;
}

export class WebSpeechProvider implements SpeechProvider {
  readonly id = "web-speech";

  async hasVoice(lang: string) {
    return pickVoice(await loadVoices(), lang) !== null;
  }

  async speak(text: string, options: SpeakOptions) {
    const engine = synthesis();
    if (!engine) throw new Error("UNAVAILABLE");
    const voice = pickVoice(await loadVoices(), options.lang);
    if (!voice) throw new Error("NO_VOICE");
    engine.cancel();
    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = options.rate;
      utterance.onboundary = (event) => options.onBoundary?.(event.charIndex);
      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") resolve();
        else reject(new Error(event.error));
      };
      engine.speak(utterance);
    });
  }

  pause() {
    synthesis()?.pause();
  }

  resume() {
    synthesis()?.resume();
  }

  cancel() {
    synthesis()?.cancel();
  }
}

let defaultProvider: SpeechProvider | null = null;

export function getSpeechProvider(): SpeechProvider {
  defaultProvider ??= new WebSpeechProvider();
  return defaultProvider;
}

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
export interface ReaderControlSettings { volumeKeys: boolean; keepAwake: boolean; orientation: "auto" | "portrait" | "landscape"; brightness: number; tapZones: boolean }
export const defaultReaderControls: ReaderControlSettings = { volumeKeys: false, keepAwake: false, orientation: "auto", brightness: -1, tapZones: false };
export const ReaderControls = registerPlugin<{
  shareBook(options: { path: string; name: string; mimeType: string }): Promise<void>;
  configure(options: ReaderControlSettings): Promise<void>;
  voices(): Promise<{ voices: { voiceURI: string; name: string; lang: string }[] }>;
  speak(options: { text: string; voice: string; rate: number }): Promise<{ cancelled?: boolean }>;
  stop(): Promise<void>;
  addListener(event: "pageTurn", listener: (event: { direction: number }) => void): Promise<PluginListenerHandle>;
}>("ReaderControls");
export const hasNativeReaderControls = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("ReaderControls");

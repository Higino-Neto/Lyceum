/** Renderer-facing contract of the Kindle e-mail sender (types only, safe to import from the preload). */

export type KindleEmailProvider = "gmail" | "outlook" | "icloud" | "yahoo" | "custom";

export interface KindleEmailSettings {
  kindleAddress: string;
  senderAddress: string;
  provider: KindleEmailProvider;
  host: string;
  port: number;
  /** true = implicit TLS (465); false = STARTTLS upgrade (587). */
  secure: boolean;
  username: string;
  /** "google" = signed in with Google (OAuth, Gmail API); "password" = SMTP with an app password. */
  authMethod: KindleEmailAuthMethod;
}

export type KindleEmailAuthMethod = "password" | "google";

export interface KindleEmailPublicConfig extends KindleEmailSettings {
  hasPassword: boolean;
  /** False when the OS keychain is unavailable: the password then lives only in memory for this session. */
  passwordPersisted: boolean;
  encryptionAvailable: boolean;
  configured: boolean;
  /** A Google OAuth client is bundled with this build, so "Sign in with Google" can be offered. */
  googleSignInAvailable: boolean;
  googleConnected: boolean;
  /** Largest file the configured account can attach (Gmail caps messages at 25 MB). */
  maxAttachmentBytes: number;
}

export interface KindleEmailSaveInput extends Partial<KindleEmailSettings> {
  /** undefined keeps the stored password, "" clears it. */
  password?: string;
}

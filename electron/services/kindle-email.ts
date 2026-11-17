import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import {
  refreshGoogleAccessToken,
  revokeGoogleToken,
  sendGmailRawMessage,
  signInWithGoogle,
  type GoogleOAuthClient,
} from "./google-oauth";
import type {
  KindleEmailProvider,
  KindleEmailPublicConfig,
  KindleEmailSaveInput,
  KindleEmailSettings,
} from "./kindle-email-types";
import { maxEmailAttachmentBytes, type KindleSendError, type KindleSendErrorCode } from "../../src/features/kindle/kindleSendPlan";

export type * from "./kindle-email-types";

export interface KindleEmailAttachment {
  filePath: string;
  fileName: string;
}

export interface SecretStore {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

interface StoredConfig extends KindleEmailSettings {
  encryptedPassword?: string;
  encryptedRefreshToken?: string;
}

export const KINDLE_EMAIL_PRESETS: Record<Exclude<KindleEmailProvider, "custom">, Pick<KindleEmailSettings, "host" | "port" | "secure">> = {
  gmail: { host: "smtp.gmail.com", port: 465, secure: true },
  outlook: { host: "smtp-mail.outlook.com", port: 587, secure: false },
  icloud: { host: "smtp.mail.me.com", port: 587, secure: false },
  yahoo: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
};

/**
 * A send failure the renderer can translate: `code` + `params` pick the
 * message, `detail` keeps the raw server/exception text for diagnosis.
 */
export class KindleEmailError extends Error implements KindleSendError {
  constructor(
    readonly code: KindleSendErrorCode,
    readonly params?: Record<string, string | number>,
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "KindleEmailError";
  }
}

export function toKindleSendError(error: unknown): KindleSendError {
  if (error instanceof KindleEmailError) return { code: error.code, params: error.params, detail: error.detail };
  return { code: "unknown", detail: error instanceof Error ? error.message : String(error) };
}

const EMAIL_PATTERN = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/;

export function isValidEmail(value: string | undefined): value is string {
  return Boolean(value && EMAIL_PATTERN.test(value.trim()));
}

export function isKindleAddress(value: string | undefined) {
  return Boolean(value && /@(?:free\.)?kindle\.(?:com|cn)$/i.test(value.trim()));
}

const EMPTY_SETTINGS: KindleEmailSettings = {
  kindleAddress: "",
  senderAddress: "",
  provider: "gmail",
  ...KINDLE_EMAIL_PRESETS.gmail,
  username: "",
  authMethod: "password",
};

function normalizeSettings(input: Partial<KindleEmailSettings>, base: KindleEmailSettings): KindleEmailSettings {
  const provider = (["gmail", "outlook", "icloud", "yahoo", "custom"] as const).includes(input.provider as KindleEmailProvider)
    ? input.provider as KindleEmailProvider
    : base.provider;
  const preset = provider === "custom" ? undefined : KINDLE_EMAIL_PRESETS[provider];
  const port = Number(input.port ?? base.port);
  const senderAddress = (input.senderAddress ?? base.senderAddress).trim();
  return {
    kindleAddress: (input.kindleAddress ?? base.kindleAddress).trim(),
    senderAddress,
    provider,
    host: preset?.host ?? (input.host ?? base.host).trim(),
    port: preset?.port ?? (Number.isInteger(port) && port > 0 && port < 65536 ? port : 587),
    secure: preset?.secure ?? Boolean(input.secure ?? base.secure),
    username: (input.username ?? base.username).trim() || senderAddress,
    authMethod: provider === "gmail" && (input.authMethod ?? base.authMethod) === "google" ? "google" : "password",
  };
}

export interface KindleEmailServiceOptions {
  googleClient?: GoogleOAuthClient;
  openBrowser?: (url: string) => Promise<void> | void;
}

export class KindleEmailService {
  private sessionPassword: string | undefined;
  private sessionRefreshToken: string | undefined;
  private accessToken: { value: string; expiresAt: number } | undefined;
  private signInController: AbortController | undefined;

  constructor(
    private readonly configPath: string,
    private readonly secrets: SecretStore,
    private readonly options: KindleEmailServiceOptions = {},
  ) {}

  private read(): StoredConfig {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.configPath, "utf8")) as Partial<StoredConfig>;
      return {
        ...normalizeSettings(parsed, EMPTY_SETTINGS),
        encryptedPassword: parsed.encryptedPassword,
        encryptedRefreshToken: parsed.encryptedRefreshToken,
      };
    } catch {
      return { ...EMPTY_SETTINGS };
    }
  }

  private write(config: StoredConfig) {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    const tempPath = `${this.configPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tempPath, this.configPath);
  }

  private encryptionAvailable() {
    try {
      return this.secrets.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  private decrypt(value: string | undefined) {
    if (!value || !this.encryptionAvailable()) return undefined;
    try {
      return this.secrets.decryptString(Buffer.from(value, "base64"));
    } catch {
      return undefined;
    }
  }

  /** Encrypts a secret for disk, or returns undefined when it must stay in memory (no OS keychain). */
  private encrypt(value: string) {
    return this.encryptionAvailable() ? this.secrets.encryptString(value).toString("base64") : undefined;
  }

  private password(config: StoredConfig) {
    return this.sessionPassword || this.decrypt(config.encryptedPassword);
  }

  private refreshToken(config: StoredConfig) {
    return this.sessionRefreshToken || this.decrypt(config.encryptedRefreshToken);
  }

  private googleClient() {
    return this.options.googleClient?.clientId ? this.options.googleClient : undefined;
  }

  getPublicConfig(): KindleEmailPublicConfig {
    const config = this.read();
    const { encryptedPassword, encryptedRefreshToken, ...settings } = config;
    const hasPassword = Boolean(this.password(config));
    const googleConnected = Boolean(this.refreshToken(config));
    const usesGoogle = settings.authMethod === "google";
    const credentialsReady = usesGoogle ? googleConnected && Boolean(this.googleClient()) : hasPassword && Boolean(settings.host);
    return {
      ...settings,
      hasPassword,
      passwordPersisted: usesGoogle ? Boolean(encryptedRefreshToken) : Boolean(encryptedPassword),
      encryptionAvailable: this.encryptionAvailable(),
      configured: credentialsReady && isValidEmail(settings.kindleAddress) && isValidEmail(settings.senderAddress),
      googleSignInAvailable: Boolean(this.googleClient()),
      googleConnected,
      maxAttachmentBytes: maxEmailAttachmentBytes(settings.provider),
    };
  }

  save(input: KindleEmailSaveInput): KindleEmailPublicConfig {
    const current = this.read();
    const settings = normalizeSettings(input, current);
    if (settings.kindleAddress && !isValidEmail(settings.kindleAddress)) throw new KindleEmailError("invalid-kindle-address");
    if (settings.senderAddress && !isValidEmail(settings.senderAddress)) throw new KindleEmailError("invalid-sender");

    let encryptedPassword = current.encryptedPassword;
    if (input.password !== undefined) {
      // App passwords (Gmail, iCloud, Outlook, Yahoo) are displayed in groups
      // separated by spaces ("abcd efgh ijkl mnop") but must be sent without them.
      const typed = settings.provider === "custom" ? input.password.trim() : input.password.replace(/\s+/g, "");
      this.sessionPassword = undefined;
      encryptedPassword = typed ? this.encrypt(typed) : undefined;
      // No OS keychain: never write the password to disk in clear text.
      if (typed && !encryptedPassword) this.sessionPassword = typed;
    }
    // The Google account fixes the sender: Gmail only sends as the signed-in address.
    if (settings.authMethod === "google" && current.authMethod === "google" && current.senderAddress) {
      settings.senderAddress = current.senderAddress;
      settings.username = current.senderAddress;
    }
    this.write({ ...settings, encryptedPassword, encryptedRefreshToken: current.encryptedRefreshToken });
    return this.getPublicConfig();
  }

  /** Opens Google's consent screen in the browser and stores the resulting refresh token. */
  async connectGoogle(): Promise<KindleEmailPublicConfig> {
    const client = this.googleClient();
    if (!client || !this.options.openBrowser) throw new Error("Login com Google nao esta disponivel nesta versao.");
    this.signInController?.abort();
    const controller = new AbortController();
    this.signInController = controller;
    try {
      const current = this.read();
      const tokens = await signInWithGoogle(client, this.options.openBrowser, {
        loginHint: current.provider === "gmail" ? current.senderAddress || undefined : undefined,
        signal: controller.signal,
      });
      if (!tokens.email) throw new Error("O Google nao informou o e-mail da conta.");
      const encryptedRefreshToken = this.encrypt(tokens.refreshToken!);
      this.sessionRefreshToken = encryptedRefreshToken ? undefined : tokens.refreshToken;
      this.accessToken = { value: tokens.accessToken, expiresAt: tokens.expiresAt };
      this.write({
        ...current,
        ...KINDLE_EMAIL_PRESETS.gmail,
        provider: "gmail",
        authMethod: "google",
        senderAddress: tokens.email,
        username: tokens.email,
        encryptedRefreshToken,
      });
      return this.getPublicConfig();
    } finally {
      if (this.signInController === controller) this.signInController = undefined;
    }
  }

  cancelGoogleSignIn() {
    this.signInController?.abort();
  }

  async disconnectGoogle(): Promise<KindleEmailPublicConfig> {
    const current = this.read();
    const token = this.refreshToken(current);
    this.sessionRefreshToken = undefined;
    this.accessToken = undefined;
    this.write({ ...current, authMethod: "password", encryptedRefreshToken: undefined });
    if (token) await revokeGoogleToken(token);
    return this.getPublicConfig();
  }

  private async googleAccessToken(config: StoredConfig) {
    const client = this.googleClient();
    const refreshToken = this.refreshToken(config);
    if (!client || !refreshToken) throw new KindleEmailError("google-not-connected");
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > Date.now()) return this.accessToken.value;
    const tokens = await refreshGoogleAccessToken(client, refreshToken);
    this.accessToken = { value: tokens.accessToken, expiresAt: tokens.expiresAt };
    return tokens.accessToken;
  }

  private smtpTransport(config: StoredConfig) {
    const password = this.password(config);
    if (!config.host || !isValidEmail(config.senderAddress) || !password) {
      throw new KindleEmailError("not-configured");
    }
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: { user: config.username || config.senderAddress, pass: password },
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 120_000,
      // Attachments are local files prepared by the app; remote URLs are never fetched.
      disableUrlAccess: true,
    });
  }

  async verify() {
    const config = this.read();
    if (config.authMethod === "google") {
      await this.googleAccessToken(config);
      return;
    }
    const transporter = this.smtpTransport(config);
    try {
      await transporter.verify();
    } catch (error) {
      throw smtpFailure(error);
    } finally {
      transporter.close();
    }
  }

  /** Sends one book per message so every book gets its own delivery status. */
  async send(attachment: KindleEmailAttachment, subject: string) {
    const config = this.read();
    if (!isValidEmail(config.kindleAddress)) throw new KindleEmailError("not-configured");
    const size = (await fs.promises.stat(attachment.filePath)).size;
    const limit = maxEmailAttachmentBytes(config.provider);
    if (size > limit) {
      throw new KindleEmailError("too-large", { size: formatMegabytes(size), limit: formatMegabytes(limit) });
    }
    const message = {
      from: config.senderAddress,
      to: config.kindleAddress,
      subject: subject || attachment.fileName,
      text: "Sent with Lyceum.",
      attachments: [{ filename: attachment.fileName, path: attachment.filePath }],
    };

    if (config.authMethod === "google") {
      const accessToken = await this.googleAccessToken(config);
      const raw = await new MailComposer({ ...message, disableUrlAccess: true }).compile().build();
      const messageId = await sendGmailRawMessage(accessToken, raw);
      return { messageId, bytes: size };
    }

    const transporter = this.smtpTransport(config);
    try {
      const info = await transporter.sendMail(message);
      return { messageId: info.messageId, bytes: size };
    } catch (error) {
      throw smtpFailure(error);
    } finally {
      transporter.close();
    }
  }
}

function formatMegabytes(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

/** Maps SMTP/Gmail failures to codes the user can act on. */
export function classifySmtpError(error: unknown): KindleSendError {
  if (error instanceof KindleEmailError) return toKindleSendError(error);
  const smtp = error as { code?: string; responseCode?: number; response?: string; message?: string };
  const detail = (smtp?.response || smtp?.message || "").replace(/\s+/g, " ").slice(0, 200) || undefined;
  // Gmail returns "534-5.7.9 Application-specific password required" for the account password.
  if (smtp?.responseCode === 534 || /application-specific password/i.test(smtp?.response || "")) {
    return { code: "smtp-app-password", detail };
  }
  if (smtp?.code === "EAUTH" || smtp?.responseCode === 535) return { code: "smtp-auth", detail };
  if (smtp?.code === "ECONNECTION" || smtp?.code === "ETIMEDOUT" || smtp?.code === "ESOCKET" || smtp?.code === "EDNS") {
    return { code: "smtp-connection", params: { code: smtp.code }, detail };
  }
  if (smtp?.responseCode === 552 || /message.*(too large|size)/i.test(smtp?.response || "")) return { code: "smtp-too-large", detail };
  return { code: "unknown", detail };
}

function smtpFailure(error: unknown) {
  const classified = classifySmtpError(error);
  return new KindleEmailError(classified.code, classified.params, classified.detail);
}

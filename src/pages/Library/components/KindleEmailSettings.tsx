import { useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Pencil, PlugZap, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "../../../i18n";
import Select from "../../../components/ui/Select";
import { describeKindleError } from "../../../features/kindle/kindleSendMessages";

export type KindleEmailConfig = Awaited<ReturnType<typeof window.api.getKindleEmailConfig>>;
type Provider = KindleEmailConfig["provider"];

const PROVIDERS: Provider[] = ["gmail", "outlook", "icloud", "yahoo", "custom"];
const PROVIDER_DOMAINS: Array<[RegExp, Provider]> = [
  [/@(gmail|googlemail)\.com$/i, "gmail"],
  [/@(outlook|hotmail|live|msn)\.[a-z.]+$/i, "outlook"],
  [/@(icloud|me|mac)\.com$/i, "icloud"],
  [/@(yahoo|ymail)\.[a-z.]+$/i, "yahoo"],
];

function guessProvider(email: string): Provider | undefined {
  return PROVIDER_DOMAINS.find(([pattern]) => pattern.test(email.trim()))?.[1];
}

function Field({ label, hint, children, warning }: { label: string; hint?: string; warning?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-foreground-muted">
      <span>{label}</span>
      {children}
      {warning ? (
        <span className="flex items-start gap-1 text-[11px] leading-4 text-warning"><AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />{warning}</span>
      ) : hint ? (
        <span className="block text-[11px] leading-4 text-foreground-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

const inputClass = "h-9 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-input-placeholder focus:border-primary";

function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function KindleEmailSettingsForm({ config, onSaved, onCancel }: {
  config: KindleEmailConfig;
  onSaved: (config: KindleEmailConfig) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [kindleAddress, setKindleAddress] = useState(config.kindleAddress);
  const [senderAddress, setSenderAddress] = useState(config.senderAddress);
  const [provider, setProvider] = useState<Provider>(config.provider);
  const [host, setHost] = useState(config.host);
  const [port, setPort] = useState(String(config.port));
  const [secure, setSecure] = useState(config.secure);
  const [username, setUsername] = useState(config.username === config.senderAddress ? "" : config.username);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(config.googleConnected && config.authMethod === "google");
  const [googleEmail, setGoogleEmail] = useState(config.authMethod === "google" ? config.senderAddress : "");
  // Google sign-in is the default for Gmail when this build ships an OAuth client.
  const [authMethod, setAuthMethod] = useState<"google" | "password">(
    config.googleSignInAvailable && (config.authMethod === "google" || !config.hasPassword) ? "google" : "password",
  );
  const useGoogle = provider === "gmail" && config.googleSignInAvailable && authMethod === "google";

  const kindleWarning = kindleAddress.includes("@") && !/@(?:free\.)?kindle\.(?:com|cn)$/i.test(kindleAddress.trim())
    ? t("library:kindle.email.notKindleAddress")
    : undefined;

  // Google app passwords are always 16 letters (shown as four groups of four).
  const gmailPasswordWarning = provider === "gmail" && !useGoogle && password && !/^[a-z]{16}$/i.test(password.replace(/\s+/g, ""))
    ? t("library:kindle.email.gmailAppPasswordFormat")
    : undefined;

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      // Keep the Kindle address typed so far; the Google account then fills in the sender.
      if (kindleAddress.trim()) {
        const saved = await window.api.saveKindleEmailConfig({ kindleAddress, provider: "gmail", authMethod: "google" });
        if (!saved.success) {
          toast.error(saved.error || t("library:kindle.email.googleFailed"));
          return;
        }
      }
      const result = await window.api.connectKindleEmailGoogle();
      if (!result.success || !result.config) {
        toast.error(result.error || t("library:kindle.email.googleFailed"));
        return;
      }
      setGoogleConnected(true);
      setGoogleEmail(result.config.senderAddress);
      setSenderAddress(result.config.senderAddress);
      toast.success(t("library:kindle.email.googleConnected", { address: result.config.senderAddress }));
      onSaved(result.config);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    const next = await window.api.disconnectKindleEmailGoogle();
    setGoogleConnected(false);
    setGoogleEmail("");
    onSaved(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await window.api.saveKindleEmailConfig(useGoogle
        ? { kindleAddress, provider: "gmail", authMethod: "google" }
        : {
            kindleAddress,
            senderAddress,
            provider,
            host,
            port: Number(port),
            secure,
            username: username || senderAddress,
            authMethod: "password",
            password: password ? password : undefined,
          });
      if (!result.success || !result.config) {
        toast.error(result.errorCode ? describeKindleError(result).message : result.error || t("library:kindle.toasts.sendFailed"));
        return;
      }
      toast.success(t("library:kindle.email.saved"));
      setPassword("");
      onSaved(result.config);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label={t("library:kindle.email.kindleAddress")} hint={t("library:kindle.email.kindleAddressHint")} warning={kindleWarning}>
        <input type="email" value={kindleAddress} onChange={(event) => setKindleAddress(event.target.value)} placeholder="nome_123@kindle.com" className={inputClass} autoComplete="off" />
      </Field>
      <Field label={t("library:kindle.email.provider")}>
        <Select
          value={provider}
          onChange={(value) => setProvider(value as Provider)}
          className="h-9 w-full text-sm"
          items={PROVIDERS.map((value) => ({ value, label: t(`library:kindle.email.providers.${value}` as const) }))}
        />
      </Field>
      {useGoogle ? (
        <div className="space-y-2 rounded-sm border border-border bg-surface p-3">
          {googleConnected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="flex-shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-xs text-foreground">{t("library:kindle.email.googleConnectedAs", { address: googleEmail })}</p>
              <button type="button" onClick={() => void disconnectGoogle()} className="flex-shrink-0 text-xs text-foreground-subtle hover:text-destructive">
                {t("library:kindle.email.googleDisconnect")}
              </button>
            </div>
          ) : connecting ? (
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="flex-shrink-0 animate-spin text-primary" />
              <p className="min-w-0 flex-1 text-xs text-foreground">{t("library:kindle.email.googleWaiting")}</p>
              <button type="button" onClick={() => void window.api.cancelKindleEmailGoogle()} className="flex-shrink-0 text-xs text-foreground-subtle hover:text-foreground">
                {t("library:kindle.email.cancelEdit")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void connectGoogle()}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-border-strong bg-background text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              <GoogleMark />
              {t("library:kindle.email.googleSignIn")}
            </button>
          )}
          <p className="text-[11px] leading-4 text-foreground-subtle">{t("library:kindle.email.googleHint")}</p>
          <p className="text-[11px] leading-4 text-foreground-subtle">{t("library:kindle.email.senderHint")}</p>
          <button type="button" onClick={() => setAuthMethod("password")} className="text-[11px] text-foreground-subtle underline hover:text-foreground">
            {t("library:kindle.email.useAppPassword")}
          </button>
        </div>
      ) : (
      <>
      <Field label={t("library:kindle.email.sender")} hint={t("library:kindle.email.senderHint")}>
        <input
          type="email"
          value={senderAddress}
          onChange={(event) => {
            setSenderAddress(event.target.value);
            const guessed = guessProvider(event.target.value);
            if (guessed && provider !== "custom") setProvider(guessed);
          }}
          placeholder="voce@gmail.com"
          className={inputClass}
          autoComplete="email"
        />
      </Field>
      {provider === "custom" && (
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
          <Field label={t("library:kindle.email.host")}>
            <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="smtp.exemplo.com" className={inputClass} />
          </Field>
          <Field label={t("library:kindle.email.port")}>
            <input inputMode="numeric" value={port} onChange={(event) => setPort(event.target.value.replace(/\D/g, ""))} className={inputClass} />
          </Field>
          <Field label={t("library:kindle.email.security")}>
            <Select
              value={secure ? "tls" : "starttls"}
              onChange={(value) => {
                setSecure(value === "tls");
                setPort(value === "tls" ? "465" : "587");
              }}
              className="h-9 w-full text-sm"
              items={[
                { value: "tls", label: t("library:kindle.email.secureTls") },
                { value: "starttls", label: t("library:kindle.email.starttls") },
              ]}
            />
          </Field>
          <Field label={t("library:kindle.email.username")}>
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t("library:kindle.email.usernamePlaceholder")} className={inputClass} />
          </Field>
        </div>
      )}
      <Field
        label={t("library:kindle.email.password")}
        hint={config.encryptionAvailable ? t("library:kindle.email.passwordHint") : undefined}
        warning={gmailPasswordWarning || (config.encryptionAvailable ? undefined : t("library:kindle.email.passwordSessionOnly"))}
      >
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={config.hasPassword ? t("library:kindle.email.passwordSaved") : ""}
          className={inputClass}
          autoComplete="new-password"
        />
      </Field>
      {provider === "gmail" && config.googleSignInAvailable && (
        <button type="button" onClick={() => setAuthMethod("google")} className="text-[11px] text-foreground-subtle underline hover:text-foreground">
          {t("library:kindle.email.useGoogle")}
        </button>
      )}
      </>
      )}
      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-9 flex-1 rounded-sm border border-border bg-background text-sm text-foreground hover:bg-surface-muted">
            {t("library:kindle.email.cancelEdit")}
          </button>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || connecting || !kindleAddress.trim() || (useGoogle
            ? !googleConnected
            : Boolean(gmailPasswordWarning) || !senderAddress.trim() || (!password && !config.hasPassword))}
          className="flex h-9 flex-[1.4] items-center justify-center gap-2 rounded-sm bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <RefreshCw size={14} className="animate-spin" />}
          {t("library:kindle.email.save")}
        </button>
      </div>
    </div>
  );
}

export function KindleEmailSummary({ config, onEdit, disabled }: { config: KindleEmailConfig; onEdit: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; detail?: string } | null>(null);

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.api.verifyKindleEmail();
      setTestResult(result.success ? { success: true } : { success: false, ...describeKindleError(result) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Mail size={17} className="mt-0.5 flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{t("library:kindle.email.sendingTo", { address: config.kindleAddress })}</p>
          <p className="truncate text-xs text-foreground-subtle">
            {t(config.authMethod === "google" ? "library:kindle.email.fromGoogle" : "library:kindle.email.from", { address: config.senderAddress })}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="rounded-sm p-2 text-foreground-subtle hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          title={t("library:kindle.email.edit")}
          aria-label={t("library:kindle.email.edit")}
        >
          <Pencil size={14} />
        </button>
      </div>
      {!config.passwordPersisted && (
        <p className="flex items-start gap-1 text-[11px] leading-4 text-warning"><AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />{t("library:kindle.email.passwordSessionOnly")}</p>
      )}
      <button
        type="button"
        onClick={() => void test()}
        disabled={testing || disabled}
        className="inline-flex h-8 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3 text-xs text-foreground hover:bg-surface-muted disabled:opacity-50"
      >
        {testing ? <RefreshCw size={13} className="animate-spin" /> : <PlugZap size={13} />}
        {t("library:kindle.email.test")}
      </button>
      {testResult && (
        <p className={`flex items-start gap-1.5 text-xs ${testResult.success ? "text-primary" : "text-destructive"}`} role="status">
          {testResult.success ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />}
          <span className="min-w-0 break-words">
            {testResult.success ? t("library:kindle.email.testOk") : testResult.message}
            {testResult.detail && <span className="mt-0.5 block text-[11px] text-foreground-subtle">{testResult.detail}</span>}
          </span>
        </p>
      )}
    </div>
  );
}

import { translate, type TranslationKey } from "../../i18n";
import type { KindleSendErrorCode, KindleSendStage } from "./kindleSendPlan";

const KNOWN_ERRORS = new Set<KindleSendErrorCode>([
  "source-missing", "unsupported-format", "kfx-email", "needs-azw3", "invalid-azw3", "too-large", "canceled",
  "no-device", "copy-failed", "conversion-failed", "not-configured", "google-not-connected", "smtp-app-password",
  "smtp-auth", "smtp-connection", "smtp-too-large", "invalid-kindle-address", "invalid-sender", "unknown",
]);

export interface KindleErrorLike {
  errorCode?: string;
  errorParams?: Record<string, string | number>;
  error?: string;
}

/**
 * User-facing message for a failed Kindle send. `detail` carries the raw
 * server/exception text, shown smaller under the message for diagnosis.
 */
export function describeKindleError(result: KindleErrorLike): { message: string; detail?: string } {
  const code = result.errorCode as KindleSendErrorCode | undefined;
  if (code && KNOWN_ERRORS.has(code)) {
    const message = translate(`library:kindle.errors.${code}` as TranslationKey, result.errorParams);
    const detail = result.error && result.error !== code ? result.error : undefined;
    return { message, detail };
  }
  return { message: result.error || translate("library:kindle.errors.unknown") };
}

export function kindleStageLabel(stage: KindleSendStage | string | undefined): string {
  return translate(`library:kindle.stages.${stage || "preparing"}` as TranslationKey);
}

const STAGE_MESSAGE_PREFIX = "kindle-stage:";

/** The conversion queue receives Kindle steps as "kindle-stage:<stage>" messages. */
export function translateKindleStageMessage(message: string): string | null {
  return message.startsWith(STAGE_MESSAGE_PREFIX) ? kindleStageLabel(message.slice(STAGE_MESSAGE_PREFIX.length)) : null;
}

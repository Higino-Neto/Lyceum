import type { NativeApkUpdateState } from "../nativeApkUpdater";
import { getActiveLocale, translate } from "../../i18n";

export function formatMobileBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 MB";
  const value = bytes / (1024 * 1024);
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  return `${value.toFixed(1)} MB`;
}

export function formatMobileDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(getActiveLocale());
}

export function getNativeApkUpdateText(state: NativeApkUpdateState) {
  switch (state.status) {
    case "checking":
      return translate("mobile:updater.checking");
    case "available":
      return translate("mobile:updater.available");
    case "not-available":
      return translate("mobile:updater.notAvailable");
    case "not-published":
      return state.error || translate("mobile:updater.notPublished");
    case "permission-required":
      return translate("mobile:updater.permissionRequired");
    case "downloading":
      return translate("mobile:updater.downloading");
    case "installing":
      return translate("mobile:updater.installing");
    case "error":
      return state.error || translate("mobile:updater.checkFailed");
    case "unsupported":
      return translate("mobile:updater.androidOnly");
    default:
      return translate("mobile:updater.idle");
  }
}

import { useCallback, useEffect, useState } from "react";
import { translate } from "../i18n";
import toast from "react-hot-toast";
import { checkNativeApkUpdate, installNativeApkUpdate, openInstallPermissionSettings, type NativeApkUpdateState } from "./nativeApkUpdater";
const INITIAL_NATIVE_APK_UPDATE_STATE: NativeApkUpdateState = { status: "idle" };
export function useMobileUpdater() {
  const [nativeApkUpdate, setNativeApkUpdate] = useState<NativeApkUpdateState>(INITIAL_NATIVE_APK_UPDATE_STATE);
  const [nativeApkUpdateBusy, setNativeApkUpdateBusy] = useState(false);

  const refreshNativeApkUpdate = useCallback(async (silent = false) => {
    setNativeApkUpdate((current) => ({ ...current, status: "checking", error: undefined }));
    const result = await checkNativeApkUpdate();
    setNativeApkUpdate(result);

    if (!silent) {
      if (result.status === "available") {
        toast.success(translate("mobile:updater.available"));
      } else if (result.status === "not-available") {
        toast.success(translate("mobile:updater.notAvailable"));
      } else if (result.status === "not-published") {
        toast(result.error || translate("mobile:updater.notPublished"));
      } else if (result.status === "error") {
        toast.error(result.error || translate("mobile:updater.checkFailed"));
      }
    }

    return result;
  }, []);

  const installNativeUpdate = useCallback(async () => {
    const manifest = nativeApkUpdate.manifest;
    if (!manifest) {
      toast.error(translate("mobile:updater.idle"));
      return;
    }

    setNativeApkUpdateBusy(true);
    setNativeApkUpdate((current) => ({
      ...current,
      status: "downloading",
      progress: { loaded: 0, total: manifest.sizeBytes || 0, percent: 0 },
      error: undefined,
    }));

    const result = await installNativeApkUpdate(manifest, (progress) => {
      setNativeApkUpdate((current) => ({
        ...current,
        status: "downloading",
        progress,
      }));
    });

    setNativeApkUpdate((current) => ({ ...current, ...result }));
    setNativeApkUpdateBusy(false);

    if (result.status === "permission-required") {
      toast(translate("mobile:updater.permissionRequired"));
    } else if (result.status === "installing") {
      toast.success(translate("mobile:updater.confirmInstall"));
    } else if (result.status === "error") {
      toast.error(result.error || translate("mobile:updater.installFailed"));
    }
  }, [nativeApkUpdate.manifest]);

  const openNativeInstallSettings = useCallback(async () => {
    try {
      await openInstallPermissionSettings();
      toast(translate("mobile:updater.permissionHint"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : translate("mobile:updater.openSettingsFailed"));
    }
  }, []);

  useEffect(() => {
    void refreshNativeApkUpdate(true);
  }, [refreshNativeApkUpdate]);

  return { nativeApkUpdate, nativeApkUpdateBusy, refreshNativeApkUpdate, installNativeUpdate, openNativeInstallSettings };
}

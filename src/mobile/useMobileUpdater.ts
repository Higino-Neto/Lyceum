import { useCallback, useEffect, useState } from "react";
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
        toast.success("Atualizacao disponivel");
      } else if (result.status === "not-available") {
        toast.success("Voce ja esta na versao mais recente");
      } else if (result.status === "not-published") {
        toast(result.error || "Nenhuma versao mobile foi publicada ainda");
      } else if (result.status === "error") {
        toast.error(result.error || "Falha ao verificar atualizacao");
      }
    }

    return result;
  }, []);

  const installNativeUpdate = useCallback(async () => {
    const manifest = nativeApkUpdate.manifest;
    if (!manifest) {
      toast.error("Nenhuma atualizacao disponivel");
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
      toast("Permissao de instalacao necessaria");
    } else if (result.status === "installing") {
      toast.success("Confirme a instalacao no Android");
    } else if (result.status === "error") {
      toast.error(result.error || "Falha ao instalar atualizacao");
    }
  }, [nativeApkUpdate.manifest]);

  const openNativeInstallSettings = useCallback(async () => {
    try {
      await openInstallPermissionSettings();
      toast("Ative a permissao e volte ao Lyceum para atualizar");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao abrir permissoes");
    }
  }, []);

  useEffect(() => {
    void refreshNativeApkUpdate(true);
  }, [refreshNativeApkUpdate]);

  return { nativeApkUpdate, nativeApkUpdateBusy, refreshNativeApkUpdate, installNativeUpdate, openNativeInstallSettings };
}

import { RefreshCw, WifiOff } from "lucide-react";
import { getAuthErrorMessage } from "../lib/supabaseAuth";
import { useTranslation } from "../i18n";

export default function MobileQueryError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (!error) return null;
  const offline = navigator.onLine === false;
  return (
    <div className="rounded-lg border border-warning/30 bg-warning-muted p-4" role="alert">
      <div className="flex items-start gap-3">
        {offline ? <WifiOff className="mt-0.5 shrink-0 text-warning" size={18} /> : <RefreshCw className="mt-0.5 shrink-0 text-warning" size={18} />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-warning">
            {offline
              ? t("mobile:queryError.offlineTitle")
              : t("mobile:queryError.loadTitle")}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-warning">
            {offline
              ? t("mobile:queryError.offlineBody")
              : getAuthErrorMessage(error)}
          </p>
        </div>
      </div>
      <button
        className="mt-3 h-10 w-full rounded-md border border-warning/30 text-xs font-semibold text-warning"
        onClick={onRetry}
        type="button"
      >
        {t("mobile:queryError.retry")}
      </button>
    </div>
  );
}

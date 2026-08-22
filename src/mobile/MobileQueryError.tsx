import { RefreshCw, WifiOff } from "lucide-react";
import { getMobileAuthErrorMessage } from "./supabaseMobile";

export default function MobileQueryError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  if (!error) return null;
  const offline = navigator.onLine === false;
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4" role="alert">
      <div className="flex items-start gap-3">
        {offline ? <WifiOff className="mt-0.5 shrink-0 text-amber-300" size={18} /> : <RefreshCw className="mt-0.5 shrink-0 text-amber-300" size={18} />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-100">
            {offline ? "Sem conexao" : "Nao foi possivel carregar estes dados"}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-amber-200/80">
            {offline ? "Reconecte-se para sincronizar sua conta." : getMobileAuthErrorMessage(error)}
          </p>
        </div>
      </div>
      <button
        className="mt-3 h-10 w-full rounded-md border border-amber-400/30 text-xs font-semibold text-amber-100"
        onClick={onRetry}
        type="button"
      >
        Tentar novamente
      </button>
    </div>
  );
}

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Confirm = (message: string) => Promise<boolean>;
type Choice = (message: string, options: { value: string; label: string }[]) => Promise<string | null>;
const ChoiceContext = createContext<Choice | null>(null);
const ConfirmContext = createContext<Confirm | null>(null);

export function MobileConfirmProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string>();
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const pending = useRef<((answer: string | null) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const finish = useCallback((answer: string | null) => {
    dialog.current?.close();
    pending.current?.(answer);
    pending.current = null;
    setMessage(undefined);
    previousFocus.current?.focus();
  }, []);
  const choose = useCallback<Choice>((text, choices) => {
    // A second operation cannot silently approve the first one.
    pending.current?.(null);
    previousFocus.current = document.activeElement as HTMLElement;
    setMessage(text);
    setOptions(choices);
    return new Promise((resolve) => { pending.current = resolve; });
  }, []);
  const confirm = useCallback<Confirm>(message => choose(message, [{ value: "confirm", label: "Confirmar" }]).then(answer => answer === "confirm"), [choose]);
  useEffect(() => {
    if (message && !dialog.current?.open) dialog.current?.showModal();
  }, [message]);
  useEffect(() => () => { pending.current?.(null); }, []);
  return <ConfirmContext.Provider value={confirm}><ChoiceContext.Provider value={choose}>
    {children}
    <dialog ref={dialog} aria-labelledby="mobile-confirm-title" aria-describedby="mobile-confirm-message"
      onCancel={(event) => { event.preventDefault(); finish(null); }}
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 backdrop:bg-black/70">
      <h2 id="mobile-confirm-title" className="text-lg font-semibold">Confirmar ação</h2>
      <p id="mobile-confirm-message" className="my-4 text-sm leading-6 text-zinc-300">{message}</p>
      <div className="flex flex-wrap justify-end gap-3">
        <button autoFocus type="button" className="rounded-xl bg-zinc-800 px-4 py-3" onClick={() => finish(null)}>Cancelar</button>
        {options.map(option => <button key={option.value} type="button" className="rounded-xl bg-emerald-700 px-4 py-3" onClick={() => finish(option.value)}>{option.label}</button>)}
      </div>
    </dialog>
  </ChoiceContext.Provider></ConfirmContext.Provider>;
}

export function useMobileConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("MobileConfirmProvider ausente");
  return confirm;
}

export function useMobileChoice() { const choose = useContext(ChoiceContext); if (!choose) throw new Error("MobileConfirmProvider ausente"); return choose; }

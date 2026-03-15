import { useState, useEffect, useRef, useCallback } from "react";
import {
  BookOpen,
  Play,
  Pause,
  RotateCcw,
  Timer,
  X,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import type { TimerState, SessionTimerData } from "../../../types/ReadingTypes";
import { supabase } from "../../../lib/supabase";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "25min", minutes: 25 },
  { label: "45min", minutes: 45 },
  { label: "1h", minutes: 60 },
  { label: "1h30", minutes: 90 },
];

const CATEGORIES = [
  { value: "fiction", label: "Ficção", multiplier: "1x" },
  { value: "math", label: "Matemática", multiplier: "2.5x" },
  { value: "science", label: "Ciências naturais", multiplier: "2.5x" },
  { value: "philosophy", label: "Filosofia/História", multiplier: "1.5x" },
  { value: "computer_science", label: "Computação/Docs", multiplier: "2x" },
  { value: "languages", label: "Idioma em Aprendizado", multiplier: "3x" },
  { value: "other", label: "Outro", multiplier: "1x" },
];

const STATE_COLORS: Record<TimerState, string> = {
  idle: "text-zinc-100",
  running: "text-green-400",
  paused: "text-amber-400",
  finished: "text-green-300",
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatTime(seconds: number, hideSeconds: boolean, hideAll: boolean) {
  if (hideAll) return "••:••";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const hStr = h > 0 ? `${String(h).padStart(2, "0")}:` : "";
  const mStr = String(m).padStart(2, "0");
  const sStr = hideSeconds ? ":••" : `:${String(s).padStart(2, "0")}`;
  return `${hStr}${mStr}${sStr}`;
}

function playFinishChime() {
  try {
    const ctx = new AudioContext();
    [0, 0.4, 0.8].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = [523.25, 659.25, 783.99][i];
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + delay + 0.8,
      );
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.8);
    });
  } catch {
    // AudioContext pode não estar disponível em todos os contextos
  }
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function CircularProgress({
  progress,
  size = 120,
}: {
  progress: number;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(39,39,42,0.8)"
        strokeWidth="4"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#timerGradient)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
      <defs>
        <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReadingSessionTimerProps {
  fileName?: string;
  onSessionStart: () => void;
  onSessionFinish: () => void;
  /** Chamado com dados do timer quando a sessão é concluída */
  onSessionData: (data: SessionTimerData) => void;
  /** Chamado após onSessionData — sinaliza ao pai que pode abrir o modal quando o PDF também estiver pronto */
  onTimerDone: () => void;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReadingSessionTimer({
  fileName,
  onSessionStart,
  onSessionFinish,
  onSessionData,
  onTimerDone,
}: ReadingSessionTimerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [customMinutes, setCustomMinutes] = useState("");
  const [hideAll, setHideAll] = useState(false);
  const [hideSeconds, setHideSeconds] = useState(false);
  const [isHoveringTimer, setIsHoveringTimer] = useState(false);

  const [sourceName, setSourceName] = useState(
    fileName?.replace(".pdf", "") ?? "",
  );
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string; points_per_page: number }[]>([]);

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase.from("categories").select("*");
      if (data) setCategories(data);
    };
    loadCategories();
  }, []);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const startTimeRef = useRef<Date | null>(null);

  // ── Fecha o painel ao clicar fora ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // ── Tick do timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerState !== "running") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setTimerState("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState]);

  // ── Reação ao timer terminar ─────────────────────────────────────────────
  useEffect(() => {
    if (timerState !== "finished") return;

    const spentTimeMinutes = Math.floor(totalSeconds / 60);

    // 1. Envia dados do timer ao pai
    onSessionData({
      id: sessionIdRef.current,
      sourceName,
      date: startTimeRef.current ?? new Date(),
      category,
      spentTimeMinutes,
    });

    // 2. Pede ao PdfReader para calcular palavras/páginas
    onSessionFinish();

    // 3. Sinaliza que o timer terminou (pai controlará abertura do modal)
    onTimerDone();

    playFinishChime();
  }, [timerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ações do timer ────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (timerState === "idle") {
      sessionIdRef.current = crypto.randomUUID();
      startTimeRef.current = new Date();
      onSessionStart();
    }
    setTimerState("running");
  }, [timerState, onSessionStart]);

  const handlePause = useCallback(() => setTimerState("paused"), []);

  const handleReset = useCallback(() => {
    setTimerState("idle");
    setRemainingSeconds(totalSeconds);
  }, [totalSeconds]);

  const setDuration = useCallback((minutes: number) => {
    const secs = minutes * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setTimerState("idle");
  }, []);

  const handleCustomDuration = useCallback(() => {
    const mins = parseInt(customMinutes);
    if (mins > 0 && mins <= 480) {
      setDuration(mins);
      setCustomMinutes("");
    }
  }, [customMinutes, setDuration]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const TIMER_SIZE = 200;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Widget compacto no header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-2 px-4 py-2 rounded-sm border cursor-pointer transition-all duration-200 group ${
          timerState === "running"
            ? "border-green-600/60 bg-green-950/30 hover:bg-green-950/50"
            : timerState === "paused"
              ? "border-amber-600/60 bg-amber-950/20 hover:bg-amber-950/30"
              : "border-zinc-700/60 bg-zinc-900 hover:bg-zinc-800"
        }`}
      >
        <Timer
          size={16}
          className={
            timerState === "running"
              ? "text-green-400"
              : timerState === "paused"
                ? "text-amber-400"
                : "text-zinc-400 group-hover:text-zinc-300"
          }
        />
        {timerState === "idle" ? (
          <span className="text-md text-zinc-400 group-hover:text-zinc-300 p-[1.5px]">
            Timer
          </span>
        ) : (
          <span
            className={`text-sm font-mono font-medium tabular-nums ${STATE_COLORS[timerState]}`}
          >
            {formatTime(remainingSeconds, hideSeconds, hideAll)}
          </span>
        )}
        {timerState === "running" && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </button>

      {/* Painel expandido */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 z-40 rounded-sm border border-zinc-800 shadow-2xl overflow-hidden"
          style={{
            width: 300,
            background: "rgba(9,9,11,0.97)",
            backdropFilter: "blur(20px)",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-green-500" />
              <span className="text-sm font-semibold text-zinc-200">
                Sessão de Leitura
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Nome da obra */}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                Nome da obra
              </p>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="ex: O Senhor dos Anéis"
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-sm px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-green-600/50 transition-colors"
              />
            </div>

            {/* Categoria */}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                Categoria
              </p>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-green-600/50 transition-colors"
              >
                <option value="" className="bg-zinc-900">
                  Selecione
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">
                    {c.name} ({c.points_per_page}x)
                  </option>
                ))}
              </select>
            </div>

            {/* Timer circular */}
            <div className="flex justify-center">
              <div
                className="relative flex items-center justify-center cursor-pointer"
                style={{ width: TIMER_SIZE, height: TIMER_SIZE }}
                onMouseEnter={() => setIsHoveringTimer(true)}
                onMouseLeave={() => setIsHoveringTimer(false)}
              >
                <CircularProgress progress={progress} size={TIMER_SIZE} />

                <div className="relative flex flex-col items-center gap-1 z-10">
                  {isHoveringTimer && timerState !== "idle" ? (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => setHideAll((v) => !v)}
                        className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-zinc-800/90 border border-zinc-700/50 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/90 transition-all"
                      >
                        {hideAll ? <Eye size={12} /> : <EyeOff size={12} />}
                        {hideAll ? "Mostrar tudo" : "Ocultar tudo"}
                      </button>
                      <button
                        onClick={() => setHideSeconds((v) => !v)}
                        disabled={hideAll}
                        className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-zinc-800/90 border border-zinc-700/50 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Clock size={12} />
                        {hideSeconds ? "Mostrar segundos" : "Ocultar segundos"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`font-mono font-bold tabular-nums transition-colors ${STATE_COLORS[timerState]}`}
                        style={{
                          fontSize: timerState === "idle" ? 28 : 32,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {formatTime(
                          timerState === "idle" ? totalSeconds : remainingSeconds,
                          hideSeconds,
                          hideAll,
                        )}
                      </span>
                      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                        {timerState === "idle"
                          ? "pronto"
                          : timerState === "running"
                            ? "em andamento"
                            : timerState === "paused"
                              ? "pausado"
                              : "concluído"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center justify-center gap-3">
              {(timerState === "idle" || timerState === "paused") && (
                <button
                  onClick={handleStart}
                  className="cursor-pointer flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-black font-semibold text-sm transition-all shadow-lg shadow-green-900/30 active:scale-95"
                >
                  <Play size={14} fill="currentColor" />
                  {timerState === "paused" ? "Retomar" : "Iniciar"}
                </button>
              )}
              {timerState === "running" && (
                <button
                  onClick={handlePause}
                  className="cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 text-amber-400 text-sm font-medium transition-all active:scale-95"
                >
                  <Pause size={14} fill="currentColor" />
                  Pausar
                </button>
              )}
              {timerState === "finished" && (
                <button
                  onClick={handleReset}
                  className="cursor-pointer flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-black font-semibold text-sm transition-all active:scale-95"
                >
                  <RotateCcw size={14} />
                  Nova Sessão
                </button>
              )}
              {(timerState === "running" || timerState === "paused") && (
                <button
                  onClick={handleReset}
                  className="cursor-pointer p-2.5 rounded-xl border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all active:scale-95"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>

            {/* Presets de duração — só quando pode configurar */}
            {(timerState === "idle" || timerState === "finished") && (
              <div className="space-y-2.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest text-center">
                  Duração
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setDuration(p.minutes)}
                      className={`cursor-pointer py-2 rounded-sm text-xs font-medium transition-all ${
                        totalSeconds === p.minutes * 60
                          ? "bg-green-600/20 border border-green-600/40 text-green-400"
                          : "bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={480}
                    placeholder="Personalizado (min)"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomDuration()}
                    className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-sm px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-green-600/50 transition-colors"
                  />
                  <button
                    onClick={handleCustomDuration}
                    className="cursor-pointer px-3 py-2 rounded-sm bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:border-zinc-600 hover:text-zinc-100 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Volume2, VolumeX, Trophy, RotateCcw, HelpCircle, ArrowLeft } from "lucide-react";

const FREQUENCIES = {
  green: 415,  // Sol# / G#4
  red: 310,    // Mib / Eb4
  yellow: 252, // Si / B3
  blue: 209,   // Lab / Ab3
  error: 42    // Buzzer grave para Game Over
};

type PadColor = "green" | "red" | "yellow" | "blue";
type GameStatus = "idle" | "watching" | "playing" | "gameover";

interface GeniusGameProps {
  onBack?: () => void;
}

export function GeniusGame({ onBack }: GeniusGameProps) {
  const [sequence, setSequence] = useState<PadColor[]>([]);
  const [playerSequence, setPlayerSequence] = useState<PadColor[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [activePad, setActivePad] = useState<PadColor | null>(null);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFlashingError, setIsFlashingError] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const isPlayingSeqRef = useRef(false);

  // Carrega Recorde
  useEffect(() => {
    const savedRecord = localStorage.getItem("caca_niquel_genius_high_score");
    if (savedRecord) {
      setHighScore(parseInt(savedRecord, 10));
    }
  }, []);

  // Inicializa contexto de áudio
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
  };

  // Toca tom de som
  const playTone = useCallback((color: PadColor | "error", durationMs: number) => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const frequency = FREQUENCIES[color];
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = frequency;

      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (err) {
      console.warn("Erro ao emitir áudio:", err);
    }
  }, [soundEnabled]);

  // Função auxiliar para sleep com Promise
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const getSpeed = useCallback((level: number) => {
    if (level <= 4) return { duration: 320, gap: 120 };
    if (level <= 8) return { duration: 250, gap: 90 };
    if (level <= 12) return { duration: 200, gap: 70 };
    return { duration: 160, gap: 50 };
  }, []);

  // Executa a exibição da sequência de piscadas
  const playSequence = useCallback(async (currentSeq: PadColor[]) => {
    isPlayingSeqRef.current = true;
    setStatus("watching");
    await sleep(350); // Reduzido de 600ms para 350ms antes de começar

    const { duration, gap } = getSpeed(currentSeq.length);

    for (let i = 0; i < currentSeq.length; i++) {
      const color = currentSeq[i];
      setActivePad(color);
      playTone(color, duration);
      await sleep(duration);
      setActivePad(null);
      await sleep(gap);
    }

    isPlayingSeqRef.current = false;
    setStatus("playing");
    setPlayerSequence([]);
  }, [playTone, getSpeed]);

  // Adiciona um passo aleatório
  const addNewStep = useCallback((currentSeq: PadColor[]) => {
    const colors: PadColor[] = ["green", "red", "yellow", "blue"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const nextSeq = [...currentSeq, randomColor];
    setSequence(nextSeq);
    void playSequence(nextSeq);
  }, [playSequence]);

  // Iniciar jogo
  const startGame = () => {
    initAudio();
    setScore(0);
    setSequence([]);
    setPlayerSequence([]);
    setStatus("watching");
    addNewStep([]);
  };

  // Trata o clique do jogador
  const handlePadClick = (color: PadColor) => {
    if (status !== "playing" || isPlayingSeqRef.current) return;

    // Flash rápido do clique do jogador
    setActivePad(color);
    playTone(color, 160); // Reduzido de 250
    setTimeout(() => setActivePad(null), 110); // Reduzido de 200

    const nextPlayerSeq = [...playerSequence, color];
    setPlayerSequence(nextPlayerSeq);

    const currentIndex = nextPlayerSeq.length - 1;

    // Se errou
    if (nextPlayerSeq[currentIndex] !== sequence[currentIndex]) {
      handleGameOver();
      return;
    }

    // Se acertou tudo desta rodada
    if (nextPlayerSeq.length === sequence.length) {
      const nextScore = score + 1;
      setScore(nextScore);

      // Atualiza recorde
      if (nextScore > highScore) {
        setHighScore(nextScore);
        localStorage.setItem("caca_niquel_genius_high_score", nextScore.toString());
      }

      // Espera um tempo e vai para o próximo passo
      setStatus("watching");
      setTimeout(() => {
        addNewStep(sequence);
      }, 500); // Reduzido de 800ms para 500ms
    }
  };

  // Game over
  const handleGameOver = () => {
    setStatus("gameover");
    playTone("error", 1000);
    setIsFlashingError(true);
    setTimeout(() => setIsFlashingError(false), 1000);
  };

  // Classe utilitária do status display
  const getStatusDisplay = () => {
    switch (status) {
      case "idle":
        return { text: "Clique em Iniciar Jogo!", style: "bg-neutral-800 border-neutral-700 text-neutral-200" };
      case "watching":
        return { text: "Assista à sequência!", style: "bg-yellow border-neutral-800 text-black" };
      case "playing":
        return { text: "Sua vez! Repita", style: "bg-emerald-500 border-neutral-800 text-white" };
      case "gameover":
        return { text: "Fim de Jogo!", style: "bg-red-500 border-neutral-800 text-white" };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="flex flex-col gap-4 w-full">
      {onBack && (
        <button
          onClick={onBack}
          className="self-start flex items-center gap-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 px-4 py-2 text-sm font-black uppercase tracking-wider shadow-[2px_2px_0_0_#000] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#000] transition-all text-black cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 stroke-[3]" />
          Voltar para Mini Games
        </button>
      )}

      <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto items-stretch">
        {/* Placar e Controles (Layout Compacto com linhas mais finas) */}
        <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0_0_#000] flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-black bg-white p-3 text-center">
              <span className="block text-[10px] font-black uppercase tracking-widest text-black/60">
                Pontos
              </span>
              <span className="text-3xl font-black text-black" id="score-value">
                {score}
              </span>
            </div>
            <div className="rounded-xl border-2 border-black bg-yellow/20 p-3 text-center">
              <span className="block text-[10px] font-black uppercase tracking-widest text-yellow/80">
                Recorde
              </span>
              <span className="text-3xl font-black text-black flex items-center justify-center gap-1">
                <Trophy className="h-5 w-5 text-yellow shrink-0 fill-yellow/20 stroke-black stroke-2" />
                {highScore}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={startGame}
              disabled={status === "watching"}
              className="btn-yellow btn-yellow-hover py-3 text-lg flex items-center justify-center gap-2 rounded-xl border-2 border-black disabled:opacity-60 cursor-pointer"
            >
              {status === "watching" || status === "playing" ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin" /> Em jogo...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" /> Iniciar Jogo
                </>
              )}
            </button>

            {/* Controle de som */}
            <div className="flex items-center justify-between border-2 border-black bg-white rounded-xl p-2.5">
              <span className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5 text-black select-none">
                {soundEnabled ? (
                  <Volume2 className="h-4.5 w-4.5 stroke-[2.5]" />
                ) : (
                  <VolumeX className="h-4.5 w-4.5 stroke-[2.5]" />
                )}
                Efeitos Sonoros
              </span>
              <label className="relative inline-block w-11 h-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="absolute inset-0 bg-white border-2 border-black rounded-full peer-checked:bg-destructive transition-colors duration-200"></span>
                <span className="absolute left-[3px] bottom-[3px] w-4 h-4 bg-black rounded-full transition-transform duration-200 peer-checked:translate-x-5"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Tabuleiro Sleek Arcade Dark */}
        <section
          className={`rounded-3xl border-2 border-black bg-neutral-950 p-4 sm:p-8 shadow-[4px_4px_0_0_#000] flex flex-col items-center justify-center min-h-[380px] sm:min-h-[480px] transition-colors duration-150 ${
            isFlashingError ? "bg-red-950/80 border-red-800" : ""
          }`}
        >
          {/* Status display */}
          <div
            className={`border-2 px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest mb-6 shadow-[2px_2px_0_0_#000] ${statusDisplay.style}`}
          >
            {statusDisplay.text}
          </div>

          {/* Circular board (Modern Glow Ring) */}
          <div
            className={`relative w-72 h-72 sm:w-[380px] sm:h-[380px] md:w-[440px] md:h-[440px] rounded-full border-4 border-neutral-800 bg-neutral-900 p-3 grid grid-cols-2 grid-rows-2 gap-3 shadow-2xl ${
              status === "playing" ? "user-turn cursor-pointer" : "pointer-events-none"
            }`}
            style={{
              transform: isFlashingError ? "scale(1.02) rotate(1deg)" : "scale(1)",
              transition: "transform 0.1s"
            }}
          >
            <button
              onClick={() => handlePadClick("green")}
              disabled={status !== "playing"}
              className={`rounded-tl-full border-2 border-neutral-800 bg-emerald-600 transition-all cursor-pointer ${
                activePad === "green"
                  ? "bg-emerald-400 opacity-100 scale-95 shadow-[0_0_30px_rgba(52,211,153,0.9)] border-emerald-300"
                  : "opacity-30 hover:opacity-50 disabled:hover:opacity-30"
              }`}
              aria-label="Verde"
            />
            <button
              onClick={() => handlePadClick("red")}
              disabled={status !== "playing"}
              className={`rounded-tr-full border-2 border-neutral-800 bg-red-600 transition-all cursor-pointer ${
                activePad === "red"
                  ? "bg-red-400 opacity-100 scale-95 shadow-[0_0_30px_rgba(248,113,113,0.9)] border-red-300"
                  : "opacity-30 hover:opacity-50 disabled:hover:opacity-30"
              }`}
              aria-label="Vermelho"
            />
            <button
              onClick={() => handlePadClick("yellow")}
              disabled={status !== "playing"}
              className={`rounded-bl-full border-2 border-neutral-800 bg-amber-500 transition-all cursor-pointer ${
                activePad === "yellow"
                  ? "bg-amber-300 opacity-100 scale-95 shadow-[0_0_30px_rgba(253,230,138,0.9)] border-amber-200"
                  : "opacity-30 hover:opacity-50 disabled:hover:opacity-30"
              }`}
              aria-label="Amarelo"
            />
            <button
              onClick={() => handlePadClick("blue")}
              disabled={status !== "playing"}
              className={`rounded-br-full border-2 border-neutral-800 bg-blue-600 transition-all cursor-pointer ${
                activePad === "blue"
                  ? "bg-blue-400 opacity-100 scale-95 shadow-[0_0_30px_rgba(147,197,253,0.9)] border-blue-300"
                  : "opacity-30 hover:opacity-50 disabled:hover:opacity-30"
              }`}
              aria-label="Azul"
            />

            {/* Center console circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full border-4 border-neutral-800 bg-neutral-900 flex flex-col items-center justify-center shadow-2xl select-none">
              <span className="font-display font-black text-lg sm:text-xl md:text-2xl tracking-wider text-neutral-100">
                GENIUS
              </span>
              <span className="font-sans font-black text-[9px] sm:text-[10px] md:text-xs text-yellow uppercase tracking-widest leading-none mt-0.5 animate-pulse">
                VIP
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

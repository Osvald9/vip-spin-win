import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { Loader2, Trophy, PartyPopper, RotateCcw, Wifi, Coins, Flame, Lock, Gamepad2, Brain, Play } from "lucide-react";

import { registerParticipant, spinSlot, listActivePrizes, adminSyncAllPrizes } from "@/lib/slot.functions";
import { SlotReel } from "@/components/slot/SlotReel";
import { SlotIcon, ICON_KEYS } from "@/components/slot/SlotIcon";
import { playSpinTicks, playWin, playLose } from "@/lib/slot-sound";
const TEST_MODE = false; // Modo de teste desativado — cadastro obrigatório antes de girar

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ativação Conexão VIP" },
      {
        name: "description",
        content:
          "Ativação Conexão VIP: cadastre-se, gire o caça-níquel e concorra a brindes no stand.",
      },
      { property: "og:title", content: "Ativação Conexão VIP" },
      {
        property: "og:description",
        content: "Cadastre-se e gire o caça-níquel para concorrer a brindes no stand Conexão VIP.",
      },
    ],
  }),
  component: Kiosk,
});

type Stage = "qr" | "slot" | "spinning" | "result";
type SpinResult =
  | {
      won: true;
      prize: { id: string; name: string; icon: string };
      isClient?: boolean;
      deliveredPrize?: string;
      conditionalNote?: string;
      code: string;
    }
  | { won: false };

function Kiosk() {
  const [stage, setStage] = useState<Stage>("qr");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [finalIcons, setFinalIcons] = useState<[string, string, string]>([
    "zap",
    "wifi",
    "robot",
  ]);
  const [spinning, setSpinning] = useState(false);
  const settleCount = useRef(0);

  const spinFn = useServerFn(spinSlot);
  const syncPrizesFn = useServerFn(adminSyncAllPrizes);

  useEffect(() => {
    // Sincroniza prêmios customizados do localStorage com o backend se existirem
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("vip_custom_prizes_v4");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            syncPrizesFn({ data: { pin: "1234", prizes: parsed } }).catch(() => {});
          }
        }
      } catch {}
    }
  }, [syncPrizesFn]);

  const handleSpin = useCallback(async () => {
    setStage("spinning");
    settleCount.current = 0;

    try {
      const res = await spinFn({ data: {} });

      if (res && res.ok && res.won && res.prize) {
        setResult({
          won: true,
          prize: res.prize,
          deliveredPrize: res.deliveredPrize,
          code: res.code,
        });
        setFinalIcons([res.prize.icon, res.prize.icon, res.prize.icon]);
      } else {
        setResult({ won: false });
        const pool = ICON_KEYS.filter(Boolean);
        const a = pool[Math.floor(Math.random() * pool.length)];
        let b = pool[Math.floor(Math.random() * pool.length)];
        while (b === a) b = pool[Math.floor(Math.random() * pool.length)];
        let c = pool[Math.floor(Math.random() * pool.length)];
        while (c === a || c === b) c = pool[Math.floor(Math.random() * pool.length)];
        setFinalIcons([a, b, c]);
      }

      setSpinning(true);
      playSpinTicks(2600);
    } catch (err) {
      setStage("slot");
      setSpinning(false);
      alert("Erro ao girar. Tente novamente.");
    }
  }, [spinFn]);

  const onReelSettle = useCallback(() => {
    settleCount.current += 1;
    if (settleCount.current >= 3) {
      setSpinning(false);
      setTimeout(() => {
        if (result?.won) {
          playWin();
          fireConfetti();
        } else {
          playLose();
        }
        setStage("result");
      }, 1500);
    }
  }, [result]);

  function resetToStart() {
    setStage("qr");
    setResult(null);
    setSpinning(false);
  }

  // Idle reset de 45 segundos na tela de resultado
  useEffect(() => {
    if (stage !== "result") return;
    const t = window.setTimeout(resetToStart, 45000);
    return () => clearTimeout(t);
  }, [stage]);

  if (stage === "result" && result) {
    return <ResultScreen result={result} onRestart={resetToStart} />;
  }

  if (stage === "qr") {
    return (
      <div className="min-h-screen w-full bg-white text-black flex flex-col justify-between">
        <TopBar />

        <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-2 text-center">
          <div className="rounded-[2.5rem] border-[6px] border-black bg-white p-6 sm:p-10 w-full shadow-[10px_10px_0_0_#000] flex flex-col items-center">
            <div className="inline-block rounded-full bg-yellow border-2 border-black px-5 py-1.5 text-xs sm:text-base font-black uppercase tracking-widest text-black mb-3">
              Ativação Stand Conexão VIP
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-black leading-tight">
              Escaneie o QR Code
            </h1>

            <p className="mt-1 text-base sm:text-lg font-bold text-black/70">
              Aponte a câmera do seu celular para participar
            </p>

            <div className="mt-6 w-full flex justify-center">
              <div className="relative overflow-hidden rounded-3xl border-[5px] border-black bg-white p-4 sm:p-6 shadow-md w-full max-w-[480px]">
                <img
                  src="/qr-code.jpeg"
                  alt="QR Code Ativação"
                  className="w-full h-auto max-h-[500px] object-contain rounded-2xl mx-auto block"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStage("slot")}
              className="btn-yellow btn-yellow-hover mt-8 w-full rounded-2xl py-6 sm:py-7 text-3xl sm:text-4xl font-black uppercase tracking-wider shadow-lg"
              style={{ animation: "big-pulse 1.4s ease-in-out infinite" }}
            >
              PRÓXIMO ➔
            </button>
          </div>
        </main>

        {/* Link invisível para o painel admin no canto inferior direito */}
        <Link
          to="/admin"
          className="fixed bottom-0 right-0 w-16 h-16 z-50 cursor-default bg-transparent"
          style={{ opacity: 0.01 }}
          title="Painel Administrativo"
        />

        <footer className="py-4 text-center text-xs font-bold text-black/40">
          Conexão VIP · Todos os direitos reservados
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white text-black flex flex-col justify-between">
      <TopBar />

      <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-8 pt-2">
        <SlotBoard
          spinning={spinning}
          finalIcons={finalIcons}
          onReelSettle={onReelSettle}
          canSpin={stage === "slot"}
          isSpinning={stage === "spinning"}
          onSpin={handleSpin}
        />
      </main>

      {/* Link invisível para o painel admin no canto inferior direito */}
      <Link
        to="/admin"
        className="fixed bottom-0 right-0 w-16 h-16 z-50 cursor-default bg-transparent"
        style={{ opacity: 0.01 }}
        title="Painel Administrativo"
      />

      <footer className="py-4 text-center text-xs font-bold text-black/40">
        Conexão VIP · Todos os direitos reservados
      </footer>
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex justify-center items-center py-4">
      <img src="/logo-cnx.png" alt="CNX Logo" className="h-16 sm:h-20 max-w-xs object-contain" />
    </div>
  );
}

function SlotBoard({
  spinning,
  finalIcons,
  onReelSettle,
  canSpin,
  isSpinning,
  onSpin,
}: {
  spinning: boolean;
  finalIcons: [string, string, string];
  onReelSettle: () => void;
  canSpin: boolean;
  isSpinning: boolean;
  onSpin: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border-[6px] border-black bg-yellow p-4 sm:p-6 shadow-[8px_8px_0_0_#000] w-full">
      <div className="relative">
        {/* Title bar */}
        <div className="relative mx-2 mt-2 text-center pb-2">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-black">
            Conexão VIP
          </div>
          <div className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black mt-0.5">
            Sorteador de Brindes
          </div>
          <div className="mt-1 text-xs font-black uppercase tracking-wider text-black/70">
            Alinhe 3 símbolos iguais para ganhar um brinde!
          </div>
        </div>

        {/* Reels display */}
        <div className="mx-2 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <SlotReel spinning={spinning} finalIcon={finalIcons[0]} delay={0} onSettle={onReelSettle} />
            <SlotReel spinning={spinning} finalIcon={finalIcons[1]} delay={700} onSettle={onReelSettle} />
            <SlotReel spinning={spinning} finalIcon={finalIcons[2]} delay={1400} onSettle={onReelSettle} />
          </div>
        </div>

        {/* Big spin button */}
        <button
          type="button"
          onClick={onSpin}
          disabled={!canSpin || isSpinning}
          className="btn-yellow btn-yellow-hover relative mx-2 mt-6 block w-[calc(100%-1rem)] rounded-2xl bg-white py-7 sm:py-8 text-4xl sm:text-5xl font-black disabled:opacity-60 shadow-lg"
          style={{ animation: canSpin && !isSpinning ? "big-pulse 1.4s ease-in-out infinite" : undefined }}
        >
          {isSpinning ? (
            <span className="inline-flex items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin" /> Girando…
            </span>
          ) : (
            <span className="relative inline-block">
              GIRAR
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// BulbBorder removido

function ResultScreen({
  result,
  onRestart,
}: {
  result: SpinResult;
  onRestart: () => void;
}) {
  const displayTitle = !result.won
    ? ""
    : (result.deliveredPrize || result.prize?.name || "Prêmio Especial");

  return (
    <div className="min-h-screen w-full bg-white text-black">
      <TopBar />
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 pb-10 pt-6 text-center">
        {result.won ? (
          <>
            <div
              className="grid h-24 w-24 place-items-center rounded-3xl border-4 border-black bg-yellow shadow-sm"
              style={{ animation: "bounce-in 0.6s ease" }}
            >
              <PartyPopper className="h-12 w-12 text-black" strokeWidth={2.5} />
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl font-black leading-tight">
              Parabéns!
              <br />
              <span className="rounded-xl bg-yellow px-3 py-1 inline-block mt-2">
                Você Ganhou!
              </span>
            </h1>

            {/* Card Detalhado do Prêmio Conquistado */}
            <div className="mt-6 flex flex-col items-center justify-center gap-4 rounded-3xl border-4 border-black bg-yellow p-6 w-full shadow-md">
              <div className="text-center w-full">
                <div className="text-xs font-black uppercase tracking-widest text-black/70">
                  Seu Brinde
                </div>
                <div className="mt-2 font-display text-2xl sm:text-4xl font-black text-black">
                  {displayTitle}
                </div>

                <p className="mt-6 text-sm sm:text-base font-black text-black">
                  Retire o seu brinde com a nossa equipe no stand!
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid h-24 w-24 place-items-center rounded-3xl border-4 border-black bg-white">
              <Trophy className="h-12 w-12 text-black" strokeWidth={2.5} />
            </div>
            <h1 className="mt-5 text-3xl sm:text-4xl font-black leading-tight">
              Ainda não foi dessa vez,<br />
              <span className="rounded-lg bg-yellow px-2">mas obrigado por participar!</span>
            </h1>
            <p className="mt-4 max-w-md text-base sm:text-lg font-bold text-black">
              Continue acompanhando a Conexão VIP e aproveite as ofertas exclusivas no stand!
            </p>
          </>
        )}

        <button
          onClick={onRestart}
          className="btn-yellow btn-yellow-hover mt-8 w-full rounded-2xl py-5 text-xl font-black"
        >
          <RotateCcw className="mr-2 inline h-6 w-6" /> Nova participação
        </button>
      </div>
    </div>
  );
}

// prizePhrase removido

function fireConfetti() {
  const end = Date.now() + 1600;
  const colors = ["#FFD400", "#000000", "#FFFFFF"];
  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 120, spread: 100, origin: { y: 0.5 }, colors });
}



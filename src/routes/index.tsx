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

type Stage = "form" | "spinning" | "result";
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
  const [stage, setStage] = useState<Stage>("form");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [finalIcons, setFinalIcons] = useState<[string, string, string]>([
    "zap",
    "wifi",
    "robot",
  ]);
  const [spinning, setSpinning] = useState(false);
  const settleCount = useRef(0);

  const spinFn = useServerFn(spinSlot);
  const prizesFn = useServerFn(listActivePrizes);
  const syncPrizesFn = useServerFn(adminSyncAllPrizes);
  const registerFn = useServerFn(registerParticipant);
  const [testPool, setTestPool] = useState<Array<{ id: string; name: string; icon: string }>>([]);

  useEffect(() => {
    // Sincroniza prêmios customizados do localStorage com o backend se existirem
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("vip_custom_prizes_v3");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            syncPrizesFn({ data: { pin: "1234", prizes: parsed } }).catch(() => {});
          }
        }
      } catch {}
    }
  }, [syncPrizesFn]);

  useEffect(() => {
    if (!TEST_MODE) return;
    prizesFn().then((r) => {
      const pool = r.prizes ?? [];
      if (pool.length === 0) {
        setTestPool([
          { id: "1", name: "Copo Térmico Conexão VIP", icon: "zap" },
          { id: "2", name: "Caneta Conexão VIP", icon: "heart" },
          { id: "3", name: "Copo Plástico Conexão VIP", icon: "robot" },
        ]);
      } else {
        setTestPool(pool);
      }
    }).catch(() => {
      setTestPool([
        { id: "1", name: "Copo Térmico Conexão VIP", icon: "zap" },
        { id: "2", name: "Caneta Conexão VIP", icon: "heart" },
        { id: "3", name: "Copo Plástico Conexão VIP", icon: "robot" },
      ]);
    });
  }, [prizesFn]);

  const runTestSpin = useCallback(() => {
    setStage("spinning");
    const activePrizes = testPool.length > 0 ? testPool : [
      { id: "1", name: "Copo (Térmico / Amarelo)", icon: "zap", weight: 76 },
      { id: "2", name: "Chaveiro", icon: "heart", weight: 11 },
      { id: "3", name: "Caneta", icon: "robot", weight: 5 },
      { id: "4", name: "Lixeira de Carro", icon: "wifi", weight: 4 },
      { id: "6", name: "Boné", icon: "camera", weight: 3 },
      { id: "7", name: "1 Mês Grátis / 50% OFF Mensalidades", icon: "house", weight: 1 },
    ];
    
    const GLOBAL_WIN_CHANCE = 60;
    const isWinner = activePrizes.length > 0 && Math.random() * 100 < GLOBAL_WIN_CHANCE;

    if (isWinner) {
      const totalWeight = activePrizes.reduce((s, p: any) => s + Math.max(0, p.weight || 0), 0);
      const prizeRoll = Math.random() * (totalWeight || 1);
      let acc = 0;
      let p = activePrizes[0];
      for (const item of activePrizes) {
        acc += Math.max(0, (item as any).weight || 0);
        if (prizeRoll <= acc) {
          p = item;
          break;
        }
      }
      setResult({ won: true, prize: { id: p.id, name: p.name, icon: p.icon }, code: "TESTE-000000" });
      setFinalIcons([p.icon, p.icon, p.icon]);
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
    settleCount.current = 0;
    setSpinning(true);
    playSpinTicks(2600);
  }, [testPool]);

  const handleSpin = useCallback(
    async (id: string | null) => {
      let activeId = id;
      setStage("spinning");
      settleCount.current = 0;
      
      try {
        if (!activeId) {
          // Criar participante de teste/rápido para persistir o giro e diminuir o estoque no banco
          const tempRes = await registerFn({
            data: {
              full_name: "Giro Rápido",
              whatsapp: "rapido-" + Math.random().toString(36).substring(2, 11),
              city: "Totem",
              accepted_terms: true,
            },
          });
          if (tempRes.ok) {
            activeId = tempRes.participantId;
          } else {
            runTestSpin();
            return;
          }
        }

        const res = await spinFn({ data: { participantId: activeId } });
        
        if (res && res.ok && res.won && res.prize) {
          setResult({
            won: true,
            prize: res.prize,
            isClient: res.isClient,
            deliveredPrize: res.deliveredPrize,
            conditionalNote: res.conditionalNote,
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
        setStage("form");
        setSpinning(false);
        alert("Erro de conexão. Tente novamente.");
      }
    },
    [spinFn, registerFn],
  );

  const onReelSettle = useCallback(() => {
    settleCount.current += 1;
    if (settleCount.current >= 3) {
      setSpinning(false);
      // Atraso aumentado de 300ms para 1500ms para o jogador contemplar a combinação antes da tela de resultado surgir
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

  function reset() {
    setStage("form");
    setParticipantId(null);
    setResult(null);
    setSpinning(false);
  }

  // Idle reset on result screen
  useEffect(() => {
    if (stage !== "result") return;
    const t = window.setTimeout(reset, 30000);
    return () => clearTimeout(t);
  }, [stage]);

  if (stage === "result" && result) {
    return <ResultScreen result={result} onRestart={reset} />;
  }

  return (
    <div className="min-h-screen w-full bg-white text-black">
      <TopBar />

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-10 pt-4">
        <RegistrationForm
          disabled={stage !== "form" || !!participantId}
          participantReady={!!participantId}
          onDone={(id) => setParticipantId(id)}
        />

        <SlotBoard
          spinning={spinning}
          finalIcons={finalIcons}
          onReelSettle={onReelSettle}
          canSpin={(TEST_MODE || !!participantId) && stage === "form"}
          isSpinning={stage === "spinning"}
          onSpin={() => handleSpin(participantId)}
          testMode={TEST_MODE && !participantId}
        />
      </div>
      {/* Link invisível para o painel admin no canto inferior direito */}
      <Link
        to="/admin"
        className="fixed bottom-0 right-0 w-16 h-16 z-50 cursor-default bg-transparent"
        style={{ opacity: 0.01 }}
        title="Painel Administrativo"
      />

      {/* Botão invisível para giro rápido sem cadastro no canto inferior esquerdo */}
      {stage === "form" && (
        <button
          onClick={() => handleSpin(null)}
          className="fixed bottom-0 left-0 w-16 h-16 z-50 cursor-default bg-transparent focus:outline-none"
          style={{ opacity: 0.01 }}
          title="Girar sem cadastro"
        />
      )}
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex justify-center items-center py-6">
      <img src="/logo-cnx.png" alt="CNX Logo" className="h-20 max-w-xs object-contain" />
    </div>
  );
}

function RegistrationForm({
  onDone,
  disabled,
  participantReady,
}: {
  onDone: (id: string) => void;
  disabled: boolean;
  participantReady: boolean;
}) {
  const register = useServerFn(registerParticipant);
  const [fullName, setName] = useState("");
  const [whatsapp, setWhats] = useState("");
  const [city, setCity] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError("Informe seu nome completo.");
    if (whatsapp.replace(/\D/g, "").length < 10)
      return setError("Informe um WhatsApp válido com DDD.");
    if (city.trim().length < 2) return setError("Informe sua cidade.");
    if (!accepted) return setError("Aceite os termos para continuar.");
    setLoading(true);
    try {
      const res = await register({
        data: {
          full_name: fullName,
          whatsapp,
          city,
          accepted_terms: true as const,
        },
      });
      if (!res.ok) setError(res.error);
      else onDone(res.participantId);
    } catch {
      setError("Erro ao cadastrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border-4 border-black bg-white p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black">
          1. Seu cadastro
        </h2>
        {participantReady && (
          <span className="rounded-full border-2 border-black bg-yellow px-3 py-1 text-xs font-black uppercase tracking-widest">
            Pronto para girar
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome completo" className="sm:col-span-2">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
            className="kiosk-input"
            placeholder="Digite seu nome"
            autoComplete="off"
          />
        </Field>
        <Field label="WhatsApp (com DDD)">
          <input
            type="tel"
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => setWhats(e.target.value)}
            disabled={disabled}
            className="kiosk-input"
            placeholder="(00) 00000-0000"
            autoComplete="off"
          />
        </Field>
        <Field label="Cidade">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={disabled}
            className="kiosk-input"
            placeholder="Sua cidade"
            autoComplete="off"
          />
        </Field>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          disabled={disabled}
          className="mt-1 h-6 w-6 accent-black"
        />
        <span className="text-black">
          Aceito os termos de participação e o uso dos meus dados para contato promocional
          da <strong>Conexão VIP</strong>.
        </span>
      </label>

      {error && (
        <div className="mt-3 rounded-xl border-2 border-black bg-yellow p-3 text-sm font-bold text-black">
          {error}
        </div>
      )}

      {!participantReady && (
        <div className="flex flex-col gap-2 mt-4">
          <button
            type="submit"
            disabled={loading || disabled}
            className="btn-yellow btn-yellow-hover w-full rounded-2xl py-4 text-lg disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Cadastrando…
              </>
            ) : (
              "Cadastrar e liberar giro"
            )}
          </button>
        </div>
      )}

      <style>{`
        .kiosk-input {
          width: 100%;
          background: #fff;
          border: 3px solid #000;
          border-radius: 0.75rem;
          padding: 0.9rem 1rem;
          font-size: 1.15rem;
          color: #000;
          font-weight: 600;
        }
        .kiosk-input::placeholder { color: #666; font-weight: 500; }
        .kiosk-input:focus {
          outline: none;
          box-shadow: 0 0 0 4px var(--yellow);
        }
        .kiosk-input:disabled { background: #f5f5f5; color: #666; }
      `}</style>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-black uppercase tracking-widest text-black">
        {label}
      </div>
      {children}
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
  testMode,
}: {
  spinning: boolean;
  finalIcons: [string, string, string];
  onReelSettle: () => void;
  canSpin: boolean;
  isSpinning: boolean;
  onSpin: () => void;
  testMode?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border-[6px] border-black bg-yellow p-4 shadow-[8px_8px_0_0_#000]">
      <div className="relative">
        {/* Title bar */}
        <div className="relative mx-2 mt-2 text-center pb-2">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-black">
            Conexão VIP
          </div>
          <div className="font-display text-4xl font-black uppercase tracking-tight text-black mt-0.5">
            Sorteador de Brindes
          </div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-black/60">
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
          onClick={onSpin}
          disabled={!canSpin || isSpinning}
          className="btn-yellow btn-yellow-hover relative mx-2 mt-4 block w-[calc(100%-1rem)] rounded-2xl bg-white py-8 text-5xl disabled:opacity-60"
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


        {!canSpin && !isSpinning && !testMode && (
          <p className="mt-3 px-2 text-center text-sm font-bold uppercase tracking-widest text-black">
            Faça o cadastro abaixo para liberar o giro
          </p>
        )}
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
  const isCup =
    result.won &&
    (result.prize?.name?.toLowerCase().includes("copo") ?? false);

  const isMonthlyPlan =
    result.won &&
    ((result.prize?.name?.toLowerCase().includes("mensalidade") ||
      result.prize?.name?.toLowerCase().includes("mês") ||
      result.prize?.name?.toLowerCase().includes("desconto")) ??
      false);

  const displayTitle = !result.won
    ? ""
    : isCup
      ? "Copo Conexão VIP"
      : isMonthlyPlan
        ? "Benefício Especial Conexão VIP"
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
                <div className="mt-2 font-display text-2xl sm:text-3xl font-black text-black">
                  {displayTitle}
                </div>

                {/* Caixa Explicativa da Regra de Copos */}
                {isCup && (
                  <div className="mt-5 rounded-2xl border-3 border-black bg-white p-4 sm:p-5 text-sm sm:text-base font-bold text-black text-left space-y-3 shadow-xs">
                    <div className="p-3 rounded-xl bg-yellow/30 border-2 border-black flex items-start gap-2.5">
                      <span className="text-xl">🏆</span>
                      <div>
                        <span className="font-black text-black text-sm uppercase tracking-wide block">Se você é cliente:</span>
                        <span className="text-black font-extrabold text-base">Ganhou um Copo Térmico!</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-yellow/30 border-2 border-black flex items-start gap-2.5">
                      <span className="text-xl">🟡</span>
                      <div>
                        <span className="font-black text-black text-sm uppercase tracking-wide block">Se não é cliente:</span>
                        <span className="text-black font-extrabold text-base">Ganhou um Copo Amarelo!</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Caixa Explicativa da Regra de Mensalidade */}
                {isMonthlyPlan && (
                  <div className="mt-5 rounded-2xl border-3 border-black bg-white p-4 sm:p-5 text-sm sm:text-base font-bold text-black text-left space-y-3 shadow-xs">
                    <div className="p-3 rounded-xl bg-yellow/30 border-2 border-black flex items-start gap-2.5">
                      <span className="text-xl">🎁</span>
                      <div>
                        <span className="font-black text-black text-sm uppercase tracking-wide block">Se você é cliente:</span>
                        <span className="text-black font-extrabold text-base">Ganhou 1 Mês Grátis!</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-yellow/30 border-2 border-black flex items-start gap-2.5">
                      <span className="text-xl">🏷️</span>
                      <div>
                        <span className="font-black text-black text-sm uppercase tracking-wide block">Se não é cliente:</span>
                        <span className="text-black font-extrabold text-base">Ganhou 50% de desconto nas 2 primeiras mensalidades contratando hoje!</span>
                      </div>
                    </div>
                  </div>
                )}

                <p className="mt-5 text-sm sm:text-base font-black text-black">
                  Retire o seu brinde ou valide seu benefício com a nossa equipe no stand!
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



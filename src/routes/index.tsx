import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { Loader2, Trophy, PartyPopper, RotateCcw, Wifi, Coins, Flame } from "lucide-react";

import { registerParticipant, spinSlot, listActivePrizes } from "@/lib/slot.functions";
import { SlotReel } from "@/components/slot/SlotReel";
import { SlotIcon, ICON_KEYS } from "@/components/slot/SlotIcon";
import { playSpinTicks, playWin, playLose } from "@/lib/slot-sound";

const TEST_MODE = true; // TODO: desativar antes do evento — permite girar sem cadastro

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conexão VIP — Caça-níquel de brindes" },
      {
        name: "description",
        content:
          "Ativação Conexão VIP: cadastre-se, gire o caça-níquel e concorra a brindes no stand.",
      },
      { property: "og:title", content: "Conexão VIP — Caça-níquel de brindes" },
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
  | { won: true; prize: { id: string; name: string; icon: string }; code: string }
  | { won: false };

function Kiosk() {
  const [stage, setStage] = useState<Stage>("form");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [finalIcons, setFinalIcons] = useState<[string, string, string]>([
    "gift",
    "wifi",
    "trophy",
  ]);
  const [spinning, setSpinning] = useState(false);
  const settleCount = useRef(0);

  const spinFn = useServerFn(spinSlot);
  const prizesFn = useServerFn(listActivePrizes);
  const [testPool, setTestPool] = useState<Array<{ id: string; name: string; icon: string }>>([]);

  useEffect(() => {
    if (!TEST_MODE) return;
    prizesFn().then((r) => setTestPool(r.prizes ?? [])).catch(() => {});
  }, [prizesFn]);

  const runTestSpin = useCallback(() => {
    setStage("spinning");
    // 30% chance de perder no modo teste
    const lose = Math.random() < 0.3 || testPool.length === 0;
    if (lose) {
      setResult({ won: false });
      const pool = ICON_KEYS.filter(Boolean);
      const a = pool[Math.floor(Math.random() * pool.length)];
      let b = pool[Math.floor(Math.random() * pool.length)];
      while (b === a) b = pool[Math.floor(Math.random() * pool.length)];
      const c = pool[Math.floor(Math.random() * pool.length)];
      setFinalIcons([a, b, c]);
    } else {
      const p = testPool[Math.floor(Math.random() * testPool.length)];
      setResult({ won: true, prize: { id: p.id, name: p.name, icon: p.icon }, code: "TESTE-000000" });
      setFinalIcons([p.icon, p.icon, p.icon]);
    }
    settleCount.current = 0;
    setSpinning(true);
    playSpinTicks(2600);
  }, [testPool]);

  const handleSpin = useCallback(
    async (id: string | null) => {
      if (!id) {
        runTestSpin();
        return;
      }
      setStage("spinning");
      const res = await spinFn({ data: { participantId: id } });
      if (!res.ok) {
        setResult({ won: false });
        setFinalIcons([
          ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)],
          ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)],
          ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)],
        ] as [string, string, string]);
      } else if (res.won) {
        setResult({ won: true, prize: res.prize, code: res.code });
        setFinalIcons([res.prize.icon, res.prize.icon, res.prize.icon]);
      } else {
        setResult({ won: false });
        const pool = ICON_KEYS.filter(Boolean);
        const a = pool[Math.floor(Math.random() * pool.length)];
        let b = pool[Math.floor(Math.random() * pool.length)];
        while (b === a) b = pool[Math.floor(Math.random() * pool.length)];
        const c = pool[Math.floor(Math.random() * pool.length)];
        setFinalIcons([a, b, c]);
      }
      settleCount.current = 0;
      setSpinning(true);
      playSpinTicks(2600);
    },
    [spinFn, runTestSpin],
  );

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
      }, 300);
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
      {TEST_MODE && (
        <div className="border-b-4 border-black bg-black py-1.5 text-center text-[11px] font-black uppercase tracking-[0.3em] text-yellow">
          ⚠ Modo teste — giro liberado sem cadastro
        </div>
      )}
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-10 pt-4">
        <SlotBoard
          spinning={spinning}
          finalIcons={finalIcons}
          onReelSettle={onReelSettle}
          canSpin={(TEST_MODE || !!participantId) && stage === "form"}
          isSpinning={stage === "spinning"}
          onSpin={() => handleSpin(participantId)}
          testMode={TEST_MODE && !participantId}
        />

        <RegistrationForm
          disabled={stage !== "form" || !!participantId}
          participantReady={!!participantId}
          onDone={(id) => setParticipantId(id)}
        />
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex items-center justify-between border-b-4 border-black bg-yellow px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl border-4 border-black bg-white">
          <Wifi className="h-6 w-6 text-black" strokeWidth={3} />
        </div>
        <div className="leading-tight">
          <div className="font-display text-2xl font-black tracking-tight text-black">
            Conexão VIP
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-black">
            Ativação no evento
          </div>
        </div>
      </div>
      <div className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase tracking-widest text-black">
        Sorteio ao vivo
      </div>
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
    if (!accepted) return setError("Aceite os termos para continuar.");
    if (fullName.trim().length < 2) return setError("Informe seu nome completo.");
    if (whatsapp.replace(/\D/g, "").length < 10)
      return setError("Informe um WhatsApp válido com DDD.");
    if (city.trim().length < 2) return setError("Informe sua cidade.");
    setLoading(true);
    try {
      const res = await register({
        data: { full_name: fullName, whatsapp, city, accepted_terms: true as const },
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
        <button
          type="submit"
          disabled={loading || disabled}
          className="btn-yellow btn-yellow-hover mt-4 w-full rounded-2xl py-4 text-lg disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Cadastrando…
            </>
          ) : (
            "Cadastrar e liberar giro"
          )}
        </button>
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
}: {
  spinning: boolean;
  finalIcons: [string, string, string];
  onReelSettle: () => void;
  canSpin: boolean;
  isSpinning: boolean;
  onSpin: () => void;
}) {
  return (
    <div className="rounded-3xl border-4 border-black bg-yellow p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black">
          2. Gire e ganhe
        </h2>
        <span className="text-xs font-black uppercase tracking-widest text-black">
          3 iguais = brinde
        </span>
      </div>

      <div className="rounded-2xl border-4 border-black bg-white p-4">
        <div className="grid grid-cols-3 gap-4">
          <SlotReel spinning={spinning} finalIcon={finalIcons[0]} delay={0} onSettle={onReelSettle} />
          <SlotReel spinning={spinning} finalIcon={finalIcons[1]} delay={400} onSettle={onReelSettle} />
          <SlotReel spinning={spinning} finalIcon={finalIcons[2]} delay={800} onSettle={onReelSettle} />
        </div>
      </div>

      <button
        onClick={onSpin}
        disabled={!canSpin || isSpinning}
        className="btn-yellow btn-yellow-hover mt-5 w-full rounded-2xl bg-white py-8 text-4xl disabled:opacity-60"
      >
        {isSpinning ? (
          <>
            <Loader2 className="mr-3 inline h-9 w-9 animate-spin" /> Girando…
          </>
        ) : (
          "GIRAR"
        )}
      </button>

      {!canSpin && !isSpinning && (
        <p className="mt-3 text-center text-sm font-bold uppercase tracking-widest text-black">
          Faça o cadastro acima para liberar o giro
        </p>
      )}
    </div>
  );
}

function ResultScreen({
  result,
  onRestart,
}: {
  result: SpinResult;
  onRestart: () => void;
}) {
  return (
    <div className="min-h-screen w-full bg-white text-black">
      <TopBar />
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 pb-10 pt-10 text-center">
        {result.won ? (
          <>
            <div
              className="grid h-28 w-28 place-items-center rounded-3xl border-4 border-black bg-yellow"
              style={{ animation: "bounce-in 0.6s ease" }}
            >
              <PartyPopper className="h-14 w-14 text-black" strokeWidth={2.5} />
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight">
              Parabéns! Você ganhou{" "}
              <span className="rounded-lg bg-yellow px-2">
                {prizePhrase(result.prize)}
              </span>
              <br />
              <span className="text-2xl">Conexão VIP</span>
            </h1>

            <div className="mt-8 flex w-full items-center gap-4 rounded-2xl border-4 border-black bg-white p-5">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border-4 border-black bg-yellow">
                <SlotIcon name={result.prize.icon} className="h-14 w-14 text-black" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black uppercase tracking-widest text-black">
                  Seu prêmio
                </div>
                <div className="mt-1 font-display text-2xl font-black">{result.prize.name}</div>
              </div>
            </div>

            <div className="mt-6 w-full rounded-2xl border-4 border-black bg-yellow p-5">
              <div className="text-xs font-black uppercase tracking-widest text-black">
                Código de retirada
              </div>
              <div className="mt-1 font-display text-3xl font-black tracking-widest text-black">
                {result.code}
              </div>
              <div className="mt-4 flex justify-center">
                <img
                  alt="QR Code de retirada"
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(result.code)}&size=220x220&bgcolor=ffffff&color=000000&margin=2`}
                  className="h-44 w-44 rounded-xl border-4 border-black bg-white"
                />
              </div>
              <div className="mt-3 text-sm font-bold text-black">
                Apresente este código à nossa equipe no stand.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid h-28 w-28 place-items-center rounded-3xl border-4 border-black bg-white">
              <Trophy className="h-14 w-14 text-black" strokeWidth={2.5} />
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight">
              Ainda não foi dessa vez,<br />
              <span className="rounded-lg bg-yellow px-2">mas obrigado por participar!</span>
            </h1>
            <p className="mt-5 max-w-md text-lg font-bold text-black">
              Continue acompanhando a Conexão VIP.
            </p>
          </>
        )}

        <button
          onClick={onRestart}
          className="btn-yellow btn-yellow-hover mt-10 w-full rounded-2xl py-6 text-xl"
        >
          <RotateCcw className="mr-2 inline h-6 w-6" /> Nova participação
        </button>

        <p className="mt-8 text-xs font-bold uppercase tracking-widest text-black">
          Conexão VIP — a internet que conecta você aos melhores momentos
        </p>
      </div>
    </div>
  );
}

function prizePhrase(prize: { name: string; icon: string }) {
  const map: Record<string, string> = {
    thermos: "um copo térmico",
    pen: "uma caneta",
    cup: "um copo plástico",
  };
  return map[prize.icon] ?? prize.name;
}

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

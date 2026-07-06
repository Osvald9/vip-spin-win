import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import {
  Sparkles,
  Wifi,
  Gift,
  Trophy,
  Zap,
  ArrowRight,
  Loader2,
  Home,
} from "lucide-react";

import { registerParticipant, spinSlot, listActivePrizes } from "@/lib/slot.functions";
import { SlotReel } from "@/components/slot/SlotReel";
import { SlotIcon, ICON_KEYS } from "@/components/slot/SlotIcon";
import { playSpinTicks, playWin, playLose } from "@/lib/slot-sound";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conexão VIP — Caça-níquel de brindes" },
      {
        name: "description",
        content:
          "Ativação interativa do stand Conexão VIP. Toque, gire e concorra a brindes exclusivos no evento.",
      },
      { property: "og:title", content: "Conexão VIP — Caça-níquel de brindes" },
      {
        property: "og:description",
        content: "Toque para jogar e concorrer a brindes no stand Conexão VIP.",
      },
    ],
  }),
  component: Kiosk,
});

type Stage = "welcome" | "form" | "slot" | "spinning" | "result" | "thanks";
type SpinResult =
  | { won: true; prize: { id: string; name: string; icon: string }; code: string }
  | { won: false };

function Kiosk() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [finalIcons, setFinalIcons] = useState<[string, string, string]>(["gift", "wifi", "trophy"]);
  const [spinning, setSpinning] = useState(false);
  const settleCount = useRef(0);

  // idle reset to welcome after inactivity on thanks screen
  useEffect(() => {
    if (stage !== "thanks") return;
    const t = window.setTimeout(() => {
      setStage("welcome");
      setParticipantId(null);
      setResult(null);
    }, 25000);
    return () => clearTimeout(t);
  }, [stage]);

  const handleSpin = useCallback(async (spinFn: typeof spinSlot, id: string) => {
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
      // Ensure not 3 equal
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
  }, []);

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

  return (
    <div className="bg-kiosk relative min-h-screen w-full overflow-hidden">
      <TopBar />
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 pb-10 pt-24">
        {stage === "welcome" && <Welcome onStart={() => setStage("form")} />}
        {stage === "form" && (
          <RegistrationForm
            onDone={(id) => {
              setParticipantId(id);
              setStage("slot");
            }}
          />
        )}
        {(stage === "slot" || stage === "spinning") && (
          <SlotStage
            spinning={spinning}
            finalIcons={finalIcons}
            onReelSettle={onReelSettle}
            onSpin={() => participantId && handleSpin(useServerFn(spinSlot), participantId)}
            participantId={participantId}
            handleSpin={handleSpin}
            stage={stage}
          />
        )}
        {stage === "result" && result && (
          <ResultStage result={result} onContinue={() => setStage("thanks")} />
        )}
        {stage === "thanks" && <ThanksStage onRestart={() => setStage("welcome")} />}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5">
      <div className="flex items-center gap-2">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <Wifi className="h-6 w-6 text-primary-foreground" strokeWidth={2.8} />
        </div>
        <div className="leading-tight">
          <div className="font-display text-lg font-black tracking-tight text-foreground">
            Conexão <span className="text-primary">VIP</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Ativação · Evento
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground backdrop-blur">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Ao vivo
      </div>
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-8 flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.3em] text-primary">
        <Zap className="h-3.5 w-3.5" /> Ativação Conexão VIP
      </div>
      <h1 className="text-5xl font-black leading-[0.95] sm:text-6xl">
        <span className="shimmer-text">Conexão VIP</span>
        <br />
        <span className="text-foreground">no evento</span>
      </h1>
      <p className="mt-6 max-w-md text-lg font-medium text-muted-foreground">
        Toque para jogar e concorrer a brindes exclusivos direto no nosso stand.
      </p>

      <div className="mt-12 flex items-center gap-6 text-primary/70">
        <SlotIcon name="gift" className="h-10 w-10 animate-pulse" />
        <SlotIcon name="wifi" className="h-10 w-10 animate-pulse [animation-delay:200ms]" />
        <SlotIcon name="trophy" className="h-10 w-10 animate-pulse [animation-delay:400ms]" />
        <SlotIcon name="star" className="h-10 w-10 animate-pulse [animation-delay:600ms]" />
      </div>

      <button
        onClick={onStart}
        className="btn-vip btn-vip-hover glow-pulse mt-14 w-full max-w-md rounded-3xl px-10 py-8 text-2xl"
      >
        Toque para jogar
        <ArrowRight className="ml-3 inline h-7 w-7" />
      </button>

      <p className="mt-10 text-xs uppercase tracking-widest text-muted-foreground/70">
        A internet que conecta você aos melhores momentos
      </p>
    </div>
  );
}

function RegistrationForm({ onDone }: { onDone: (id: string) => void }) {
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
    <form onSubmit={submit} className="flex flex-1 flex-col justify-center">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-primary">
          Passo 1 de 2
        </div>
        <h2 className="text-4xl font-black leading-tight">
          Seu cadastro <span className="shimmer-text">VIP</span>
        </h2>
        <p className="mt-2 text-muted-foreground">
          Preencha para liberar seu giro no caça-níquel.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Field label="Nome completo">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setName(e.target.value)}
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
            className="kiosk-input"
            placeholder="Sua cidade"
            autoComplete="off"
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 h-6 w-6 accent-[color:var(--neon)]"
          />
          <span className="text-muted-foreground">
            Aceito os termos de participação e o uso dos meus dados para contato promocional
            da <strong className="text-foreground">Conexão VIP</strong>.
          </span>
        </label>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-vip btn-vip-hover w-full rounded-3xl px-8 py-6 text-xl disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 inline h-6 w-6 animate-spin" /> Cadastrando…
            </>
          ) : (
            <>
              Continuar <ArrowRight className="ml-2 inline h-6 w-6" />
            </>
          )}
        </button>
      </div>

      <style>{`
        .kiosk-input {
          width: 100%;
          background: var(--input);
          border: 2px solid var(--border);
          border-radius: 1rem;
          padding: 1rem 1.25rem;
          font-size: 1.25rem;
          color: var(--foreground);
          transition: border 0.15s, box-shadow 0.15s;
        }
        .kiosk-input:focus {
          outline: none;
          border-color: var(--neon);
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--neon) 25%, transparent);
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function SlotStage({
  spinning,
  finalIcons,
  onReelSettle,
  participantId,
  handleSpin,
  stage,
}: {
  spinning: boolean;
  finalIcons: [string, string, string];
  onReelSettle: () => void;
  onSpin: () => void;
  participantId: string | null;
  handleSpin: (fn: typeof spinSlot, id: string) => void;
  stage: Stage;
}) {
  const spin = useServerFn(spinSlot);
  const disabled = stage === "spinning" || !participantId;
  return (
    <div className="flex flex-1 flex-col justify-center">
      <div className="text-center">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-primary">
          Passo 2 de 2
        </div>
        <h2 className="text-4xl font-black">Gire e ganhe!</h2>
        <p className="mt-2 text-muted-foreground">Alinhe 3 ícones iguais para levar seu brinde.</p>
      </div>

      <div className="mt-10 rounded-[2rem] border-2 border-primary/40 bg-gradient-to-b from-card to-background p-5 shadow-glow">
        <div className="grid grid-cols-3 gap-3">
          <SlotReel spinning={spinning} finalIcon={finalIcons[0]} delay={0} onSettle={onReelSettle} />
          <SlotReel spinning={spinning} finalIcon={finalIcons[1]} delay={400} onSettle={onReelSettle} />
          <SlotReel spinning={spinning} finalIcon={finalIcons[2]} delay={800} onSettle={onReelSettle} />
        </div>
      </div>

      <button
        onClick={() => participantId && handleSpin(spin, participantId)}
        disabled={disabled}
        className="btn-vip btn-vip-hover glow-pulse mt-10 w-full rounded-3xl py-8 text-3xl disabled:opacity-60"
      >
        {stage === "spinning" ? (
          <>
            <Loader2 className="mr-2 inline h-8 w-8 animate-spin" /> Girando…
          </>
        ) : (
          <>GIRAR</>
        )}
      </button>
    </div>
  );
}

function ResultStage({
  result,
  onContinue,
}: {
  result: SpinResult;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {result.won ? (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--gold)]">
            <Trophy className="h-4 w-4" /> Você ganhou!
          </div>
          <div className="grid h-32 w-32 place-items-center rounded-3xl bg-gradient-to-br from-primary via-accent to-[color:var(--gold)] shadow-gold">
            <SlotIcon name={result.prize.icon} className="h-16 w-16 text-primary-foreground" />
          </div>
          <h2 className="mt-6 text-4xl font-black leading-tight">
            Parabéns! Você ganhou
            <br />
            <span className="shimmer-text">{result.prize.name}</span>
          </h2>
          <p className="mt-3 text-muted-foreground">Um brinde exclusivo Conexão VIP.</p>

          <div className="mt-8 w-full rounded-3xl border-2 border-primary/40 bg-card/70 p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Seu código de retirada
            </div>
            <div className="mt-2 font-display text-3xl font-black tracking-widest text-primary text-glow">
              {result.code}
            </div>
            <div className="mt-4 flex justify-center">
              <img
                alt="QR Code de retirada"
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(result.code)}&size=200x200&bgcolor=1a1030&color=6ff1ff&margin=2`}
                className="h-40 w-40 rounded-xl border border-primary/40"
              />
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Apresente este código à nossa equipe no stand.
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Resultado
          </div>
          <div className="grid h-28 w-28 place-items-center rounded-3xl bg-card/70 text-primary/60">
            <Sparkles className="h-14 w-14" />
          </div>
          <h2 className="mt-6 text-3xl font-black leading-tight">
            Ainda não foi dessa vez,
            <br />
            <span className="text-primary">mas obrigado por participar!</span>
          </h2>
          <p className="mt-3 max-w-sm text-muted-foreground">
            Continue acompanhando a Conexão VIP nas nossas redes e no evento.
          </p>
        </>
      )}

      <button
        onClick={onContinue}
        className="btn-vip btn-vip-hover mt-10 w-full rounded-3xl py-6 text-xl"
      >
        Continuar <ArrowRight className="ml-2 inline h-6 w-6" />
      </button>
    </div>
  );
}

function ThanksStage({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-primary to-accent shadow-glow">
        <Gift className="h-12 w-12 text-primary-foreground" />
      </div>
      <h2 className="mt-6 text-4xl font-black leading-tight">
        Retire seu prêmio com
        <br />
        <span className="shimmer-text">nossa equipe no stand.</span>
      </h2>
      <p className="mt-4 text-lg text-muted-foreground">Obrigado por participar!</p>
      <p className="mt-8 max-w-md text-base font-medium text-foreground/80">
        <span className="text-primary font-bold">Conexão VIP</span>, a internet que conecta você
        aos melhores momentos.
      </p>

      <button
        onClick={onRestart}
        className="mt-12 flex items-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 text-sm uppercase tracking-widest text-muted-foreground"
      >
        <Home className="h-4 w-4" /> Voltar ao início
      </button>
    </div>
  );
}

function fireConfetti() {
  const end = Date.now() + 1600;
  const colors = ["#6ff1ff", "#ff5cc8", "#ffd94a", "#ffffff"];
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

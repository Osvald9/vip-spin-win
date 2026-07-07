import { useState, useEffect, useRef, useCallback } from "react";
import { Flame, Wifi, Star, Crown, Gem, Coins, Clover, Trophy, Timer, ArrowLeft } from "lucide-react";

type Level = "facil" | "medio" | "dificil";

interface Card {
  id: number;
  iconName: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface MemoryGameProps {
  participantId: string | null;
  onFinish: (won: boolean, level: Level) => void;
  onBackToMenu: () => void;
}

const ICONS_POOL = [
  { name: "flame", Icon: Flame },
  { name: "wifi", Icon: Wifi },
  { name: "star", Icon: Star },
  { name: "crown", Icon: Crown },
  { name: "gem", Icon: Gem },
  { name: "coins", Icon: Coins },
  { name: "clover", Icon: Clover },
  { name: "trophy", Icon: Trophy },
];

function playLocalSound(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.05) {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (e) {
    console.error(e);
  }
}

export function MemoryGame({ participantId, onFinish, onBackToMenu }: MemoryGameProps) {
  const [level, setLevel] = useState<Level | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [pairsFound, setPairsFound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState<"level_select" | "playing" | "submitting">("level_select");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const totalPairs = level === "facil" ? 4 : level === "medio" ? 6 : 8;

  // Initialize the deck
  const initGame = useCallback((selectedLevel: Level) => {
    setLevel(selectedLevel);
    
    let numPairs = 4;
    let initialTime = 60;
    if (selectedLevel === "medio") {
      numPairs = 6;
      initialTime = 45;
    } else if (selectedLevel === "dificil") {
      numPairs = 8;
      initialTime = 30;
    }
    
    setTimeLeft(initialTime);
    setAttempts(0);
    setPairsFound(0);
    setFlippedIndices([]);
    
    // Choose icons
    const selectedIcons = ICONS_POOL.slice(0, numPairs).map(item => item.name);
    // Double them
    const deck = [...selectedIcons, ...selectedIcons].map((iconName, index) => ({
      id: index,
      iconName,
      isFlipped: false,
      isMatched: false,
    }));
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    setCards(deck);
    setStatus("playing");
    playLocalSound(440, 0.1, "sine");
  }, []);

  // Timer Tick
  useEffect(() => {
    if (status !== "playing") return;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleGameOver(false);
          return 0;
        }
        
        // Critical tick sound under 10 seconds
        if (prev <= 11) {
          playLocalSound(800, 0.05, "sine", 0.05);
        }
        
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const handleGameOver = (won: boolean) => {
    setStatus("submitting");
    if (timerRef.current) clearInterval(timerRef.current);
    // Block grid and send result
    onFinish(won, level!);
  };

  const handleCardClick = (clickedIndex: number) => {
    if (status !== "playing") return;
    if (flippedIndices.length >= 2) return;
    
    const card = cards[clickedIndex];
    if (card.isFlipped || card.isMatched) return;
    
    playLocalSound(523, 0.06, "sine", 0.04);
    
    const updatedCards = [...cards];
    updatedCards[clickedIndex].isFlipped = true;
    setCards(updatedCards);
    
    const newFlipped = [...flippedIndices, clickedIndex];
    setFlippedIndices(newFlipped);
    
    if (newFlipped.length === 2) {
      setAttempts(prev => prev + 1);
      const [firstIdx, secondIdx] = newFlipped;
      const firstCard = cards[firstIdx];
      const secondCard = cards[secondIdx];
      
      if (firstCard.iconName === secondCard.iconName) {
        // MATCH!
        setTimeout(() => {
          playLocalSound(659, 0.15, "triangle", 0.08);
          const matchedDeck = updatedCards.map((c, idx) => {
            if (idx === firstIdx || idx === secondIdx) {
              return { ...c, isMatched: true };
            }
            return c;
          });
          setCards(matchedDeck);
          setFlippedIndices([]);
          setPairsFound(prev => {
            const next = prev + 1;
            if (next === totalPairs) {
              // Game Won!
              setTimeout(() => {
                handleGameOver(true);
              }, 600);
            }
            return next;
          });
        }, 300);
      } else {
        // MISMATCH
        setTimeout(() => {
          playLocalSound(220, 0.15, "sawtooth", 0.04);
          const resetDeck = updatedCards.map((c, idx) => {
            if (idx === firstIdx || idx === secondIdx) {
              return { ...c, isFlipped: false };
            }
            return c;
          });
          setCards(resetDeck);
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  const getIcon = (name: string) => {
    const match = ICONS_POOL.find(item => item.name === name);
    return match ? <match.Icon className="h-10 w-10 text-[#FFD400]" /> : null;
  };

  const getDifficultyTime = (lvl: Level) => {
    if (lvl === "facil") return "60s";
    if (lvl === "medio") return "45s";
    return "30s";
  };

  if (status === "level_select") {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-[2rem] border-[6px] border-black bg-white p-6 shadow-[8px_8px_0_0_#000]">
        <button
          onClick={onBackToMenu}
          className="flex items-center gap-2 text-black font-black hover:text-black/80 transition-colors uppercase text-sm mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar aos Jogos
        </button>

        <div className="text-center py-4">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-black">
            Conexão VIP
          </div>
          <h2 className="font-display text-4xl font-black uppercase tracking-tight text-black mt-1">
            Memória Premiada
          </h2>
          <p className="mt-2 text-sm font-bold text-black/60 uppercase">
            Escolha o nível de dificuldade para iniciar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {(["facil", "medio", "dificil"] as Level[]).map(lvl => (
            <button
              key={lvl}
              onClick={() => initGame(lvl)}
              className="flex flex-col items-center justify-between p-6 rounded-2xl border-4 border-black bg-white shadow-[6px_6px_0_0_#000] hover:-translate-y-1 hover:bg-[#FFD400]/10 transition-all text-center group"
            >
              <div className="mb-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase border-2 border-black ${
                  lvl === "facil" ? "bg-green-300" : lvl === "medio" ? "bg-orange-300" : "bg-red-400"
                }`}>
                  {lvl}
                </span>
              </div>
              
              <div className="my-4">
                <Timer className="h-10 w-10 text-black group-hover:scale-110 transition-transform" />
              </div>

              <div>
                <div className="font-display text-2xl font-black uppercase text-black">
                  {lvl === "facil" ? "Fácil" : lvl === "medio" ? "Médio" : "Difícil"}
                </div>
                <div className="text-xs font-bold text-black/60 mt-1 uppercase">
                  {lvl === "facil" ? "8 cartas" : lvl === "medio" ? "12 cartas" : "16 cartas"}
                </div>
                <div className="text-sm font-black text-black mt-2">
                  Tempo: {getDifficultyTime(lvl)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Calculate progress percent
  const progressPercent = (pairsFound / totalPairs) * 100;
  const isTimeCritical = timeLeft <= 10;

  return (
    <div className="w-full max-w-4xl mx-auto rounded-[2rem] border-[6px] border-black bg-[#FFD400] p-4 md:p-6 shadow-[8px_8px_0_0_#000]">
      {/* Game Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-4 mb-6">
        <div>
          <span className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-black">
            Dificuldade: {level}
          </span>
          <div className="font-display text-2xl md:text-3xl font-black uppercase text-black mt-1">
            Memória Premiada
          </div>
        </div>

        {/* Casino Countdown Clock */}
        <div className={`flex items-center gap-2 rounded-2xl border-4 border-black px-4 py-3 min-w-[140px] justify-center transition-all ${
          isTimeCritical ? "bg-red-600 animate-pulse text-white border-white" : "bg-black text-[#FFD400]"
        }`}>
          <Timer className="h-6 w-6" />
          <span className="font-mono text-3xl font-black tracking-widest">
            {String(timeLeft).padStart(2, "0")}s
          </span>
        </div>
      </div>

      {/* Progress & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-6">
        <div className="flex justify-between items-center rounded-xl border-3 border-black bg-white p-3 font-bold text-black">
          <span>PARES:</span>
          <span className="text-xl font-black">{pairsFound} / {totalPairs}</span>
        </div>
        <div className="flex justify-between items-center rounded-xl border-3 border-black bg-white p-3 font-bold text-black">
          <span>TENTATIVAS:</span>
          <span className="text-xl font-black">{attempts}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs font-black uppercase tracking-wider text-black">
            <span>Progresso</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-6 w-full rounded-full border-3 border-black bg-white overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-black transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Grid */}
      <div className={`grid gap-4 justify-center ${
        level === "facil" ? "grid-cols-4" : level === "medio" ? "grid-cols-4" : "grid-cols-4"
      }`}>
        {cards.map((card, idx) => {
          const isFlippedOrMatched = card.isFlipped || card.isMatched;
          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(idx)}
              className="h-28 w-20 md:h-36 md:w-26 perspective-1000 cursor-pointer select-none"
            >
              <div className={`relative w-full h-full duration-500 preserve-3d transition-transform ${
                isFlippedOrMatched ? "rotate-y-180" : ""
              }`}>
                {/* Back side of card */}
                <div className="absolute w-full h-full rounded-xl border-4 border-white bg-zinc-950 flex flex-col items-center justify-center backface-hidden shadow-[4px_4px_0_0_#000] hover:border-[#FFD400] transition-colors">
                  <div className="rounded-full bg-white/10 p-2 border-2 border-dashed border-[#FFD400]/40">
                    <Wifi className="h-6 w-6 text-[#FFD400]" />
                  </div>
                </div>
                {/* Front side of card */}
                <div className={`absolute w-full h-full rounded-xl border-4 bg-zinc-900 flex items-center justify-center backface-hidden rotate-y-180 shadow-[4px_4px_0_0_#000] ${
                  card.isMatched ? "border-green-400 bg-zinc-950 scale-95 transition-all" : "border-[#FFD400]"
                }`}>
                  {getIcon(card.iconName)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

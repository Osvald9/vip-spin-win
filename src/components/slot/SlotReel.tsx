import { useEffect, useRef, useState } from "react";
import { SlotIcon, ICON_KEYS } from "./SlotIcon";

interface Props {
  spinning: boolean;
  finalIcon: string;
  delay: number;
  onSettle?: () => void;
}

export function SlotReel({ spinning, finalIcon, delay, onSettle }: Props) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [transitionMs, setTransitionMs] = useState(0);
  const settledRef = useRef(false);

  // Armazena a esteira estática de ícones que será renderizada na tela
  const [strip, setStrip] = useState<string[]>([]);

  // Dispara a animação física de giro contínuo
  useEffect(() => {
    if (!spinning) {
      setTransitionMs(0);
      setTargetIndex(0);
      return;
    }
    settledRef.current = false;

    // Monta uma nova esteira exclusiva para este giro, terminando exatamente no finalIcon correto
    const newStrip: string[] = [];
    for (let i = 0; i < 30; i++) {
      newStrip.push(ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)]);
    }
    
    const finalIndex = newStrip.length - 2; // stops at second to last index to align centered in a 1-item viewport
    newStrip[finalIndex] = finalIcon; // Injeta o ícone definitivo
    setStrip(newStrip);

    const spinTime = 1000 + delay;

    // Aguarda um frame para aplicar a transição CSS com transição de rolagem suave
    const t = requestAnimationFrame(() => {
      setTransitionMs(spinTime);
      setTargetIndex(finalIndex);
    });

    const done = window.setTimeout(() => {
      settledRef.current = true;
      onSettle?.();
    }, spinTime + 50);

    return () => {
      cancelAnimationFrame(t);
      clearTimeout(done);
    };
  }, [spinning, finalIcon, delay, onSettle]);

  // Se a esteira estiver vazia inicialmente, mostra um ícone de placeholder
  const displayStrip = strip.length > 0 ? strip : [finalIcon || "zap", finalIcon || "zap", finalIcon || "zap"];
  const curTargetIndex = strip.length > 0 ? targetIndex : 1;

  return (
    <div
      className="reel-window relative overflow-hidden rounded-2xl border-4 border-black bg-white shadow-[inset_0_4px_12px_rgba(0,0,0,0.18)] w-full aspect-square"
    >
      <div
        className="absolute left-0 right-0 flex flex-col items-center"
        style={{
          transform: `translateY(-${(curTargetIndex / displayStrip.length) * 100}%)`,
          transition: transitionMs > 0 ? `transform ${transitionMs}ms cubic-bezier(0.15, 0.7, 0.15, 1)` : "none",
        }}
      >
        {displayStrip.map((icon, i) => (
          <div key={i} className="flex items-center justify-center w-full aspect-square shrink-0 p-4">
            <SlotIcon name={icon} className="w-full h-full object-contain" />
          </div>
        ))}
      </div>
      {/* 3D cylindrical shadow overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/6 bg-gradient-to-b from-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/6 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
}

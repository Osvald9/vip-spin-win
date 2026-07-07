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

  // Build a long strip of random icons on the client only (avoid SSR hydration mismatch).
  const stripRef = useRef<string[]>([]);
  const [, forceRender] = useState(0);
  
  useEffect(() => {
    if (stripRef.current.length > 0) return;
    const strip: string[] = [];
    for (let i = 0; i < 40; i++) {
      strip.push(ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)]);
    }
    stripRef.current = strip;
    forceRender((n) => n + 1);
  }, []);

  const finalIconRef = useRef(finalIcon);
  
  // Sincroniza a ref com o finalIcon mais atualizado vindo do pai
  useEffect(() => {
    finalIconRef.current = finalIcon;
  }, [finalIcon]);

  // Dispara a animação física de giro contínuo
  useEffect(() => {
    if (!spinning) {
      setTransitionMs(0);
      setTargetIndex(0);
      return;
    }
    settledRef.current = false;

    const spinTime = 1000 + delay;

    // Quando o giro começa, montamos a esteira e colocamos o finalIcon atual da ref
    const strip = [...stripRef.current];
    const finalIndex = strip.length - 2;
    strip[finalIndex] = finalIconRef.current;
    stripRef.current = strip;

    const t = requestAnimationFrame(() => {
      setTransitionMs(spinTime);
      setTargetIndex(finalIndex);
    });

    const done = window.setTimeout(() => {
      // Ao terminar o tempo físico do rolo, garantimos que o ícone final na esteira
      // seja EXATAMENTE o finalIcon mais atualizado do banco
      const currentStrip = [...stripRef.current];
      currentStrip[finalIndex] = finalIconRef.current;
      stripRef.current = currentStrip;
      forceRender((n) => n + 1);

      settledRef.current = true;
      onSettle?.();
    }, spinTime + 50);

    return () => {
      cancelAnimationFrame(t);
      clearTimeout(done);
    };
  }, [spinning, delay, onSettle]);
  return (
    <div
      className="reel-window relative overflow-hidden rounded-2xl border-4 border-black bg-white shadow-[inset_0_4px_12px_rgba(0,0,0,0.18)] w-full aspect-square"
    >
      <div
        className="absolute left-0 right-0 flex flex-col items-center"
        style={{
          transform: `translateY(-${(targetIndex / stripRef.current.length) * 100}%)`,
          transition: transitionMs > 0 ? `transform ${transitionMs}ms cubic-bezier(0.15, 0.7, 0.15, 1)` : "none",
        }}
      >
        {stripRef.current.map((icon, i) => (
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

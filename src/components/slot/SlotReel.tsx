import { useEffect, useRef, useState } from "react";
import { SlotIcon, ICON_KEYS } from "./SlotIcon";

interface Props {
  spinning: boolean;
  finalIcon: string;
  delay: number;
  onSettle?: () => void;
}

const CELL = 128;

export function SlotReel({ spinning, finalIcon, delay, onSettle }: Props) {
  const [offset, setOffset] = useState(0);
  const [transitionMs, setTransitionMs] = useState(0);
  const settledRef = useRef(false);

  // Build a long strip of random icons, ending with the final icon at a known index.
  const stripRef = useRef<string[]>([]);
  if (stripRef.current.length === 0) {
    const strip: string[] = [];
    for (let i = 0; i < 40; i++) {
      strip.push(ICON_KEYS[Math.floor(Math.random() * ICON_KEYS.length)]);
    }
    stripRef.current = strip;
  }

  useEffect(() => {
    if (!spinning) return;
    settledRef.current = false;
    // reset instantly
    setTransitionMs(0);
    setOffset(0);

    const spinTime = 2200 + delay;
    // Replace the strip's final index with the target icon
    const strip = [...stripRef.current];
    const finalIndex = strip.length - 3;
    strip[finalIndex] = finalIcon;
    stripRef.current = strip;

    const t = requestAnimationFrame(() => {
      setTransitionMs(spinTime);
      setOffset(finalIndex * CELL);
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

  return (
    <div
      className="reel-window relative overflow-hidden rounded-3xl"
      style={{ height: CELL, width: "100%" }}
    >
      <div
        className="absolute left-0 right-0 flex flex-col items-center"
        style={{
          transform: `translateY(-${offset}px)`,
          transition: transitionMs > 0 ? `transform ${transitionMs}ms cubic-bezier(0.15, 0.7, 0.15, 1)` : "none",
        }}
      >
        {stripRef.current.map((icon, i) => (
          <div key={i} className="flex items-center justify-center" style={{ height: CELL }}>
            <SlotIcon name={icon} className="h-24 w-24 text-black" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-white" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-white" />
    </div>
  );
}

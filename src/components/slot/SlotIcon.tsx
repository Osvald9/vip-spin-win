import {
  Gift,
  Wifi,
  Trophy,
  Star,
  Sparkles,
  Zap,
  Shirt,
  Sticker,
  Coffee,
  Crown,
  Rocket,
  Award,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  gift: Gift,
  wifi: Wifi,
  trophy: Trophy,
  star: Star,
  sparkles: Sparkles,
  zap: Zap,
  shirt: Shirt,
  sticker: Sticker,
  coffee: Coffee,
  crown: Crown,
  rocket: Rocket,
  award: Award,
};

export const ICON_KEYS = Object.keys(MAP);

export function SlotIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Gift;
  return <Icon className={className} strokeWidth={2.2} />;
}

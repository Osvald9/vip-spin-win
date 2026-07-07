import {
  Gift,
  Wifi,
  Trophy,
  Star,
  Sparkles,
  Zap,
  Coffee,
  Crown,
  Award,
  GlassWater,
  PenLine,
  Thermometer,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  gift: Gift,
  wifi: Wifi,
  trophy: Trophy,
  star: Star,
  sparkles: Sparkles,
  zap: Zap,
  coffee: Coffee,
  crown: Crown,
  award: Award,
  thermos: Thermometer,
  pen: PenLine,
  cup: GlassWater,
};

export const ICON_KEYS = Object.keys(MAP);

export function SlotIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Gift;
  return <Icon className={className} strokeWidth={2.2} />;
}

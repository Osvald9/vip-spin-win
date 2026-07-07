/**
 * Componente SlotIcon - Imagens Personalizadas do Caça-Níquel Conexão VIP
 */

const CUSTOM_ICONS_MAP: Record<string, string> = {
  zap: "/icones/Prancheta 1.png",
  heart: "/icones/Prancheta 2.png",
  robot: "/icones/Prancheta 3.png",
  wifi: "/icones/Prancheta 4.png",
  house: "/icones/Prancheta 5.png",
  camera: "/icones/Prancheta 1.png", // fallback para sexta chave
};

export const ICON_KEYS = Object.keys(CUSTOM_ICONS_MAP);

export function SlotIcon({ name, className }: { name: string; className?: string }) {
  const imgSrc = (name.startsWith("http") || name.startsWith("/"))
    ? name
    : (CUSTOM_ICONS_MAP[name] ?? "/icones/Prancheta 1.png");
  
  return (
    <img
      src={imgSrc}
      className={className}
      alt={name}
      style={{
        userSelect: "none",
        pointerEvents: "none",
      }}
      draggable="false"
    />
  );
}

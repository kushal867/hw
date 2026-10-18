/** Deterministic, accessible identity for a group: the same name always gets the same colour + initials. */
const PALETTES = [
  ["#6366f1", "#8b5cf6"], ["#0ea5e9", "#6366f1"], ["#10b981", "#0ea5e9"], ["#f59e0b", "#ef4444"],
  ["#ec4899", "#8b5cf6"], ["#14b8a6", "#22c55e"], ["#f97316", "#ec4899"], ["#3b82f6", "#06b6d4"],
] as const;

export function groupGradient(seed: string) {
  let h = 0; for (const ch of seed) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const [a, b] = PALETTES[h % PALETTES.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function initials(name: string) {
  const words = name.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const letters = words.slice(0, 2).map((w) => [...w.replace(/[^\p{L}\p{N}]/gu, "")][0] ?? "");
  return (letters.join("") || "G").toUpperCase();
}

export function GroupAvatar({ name, seed, size = 44, className = "" }: { name: string; seed?: string; size?: number; className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-2xl font-bold text-white shadow-sm ${className}`}
      style={{ width: size, height: size, background: groupGradient(seed ?? name), fontSize: Math.round(size * 0.38) }}>{initials(name)}</span>
  );
}

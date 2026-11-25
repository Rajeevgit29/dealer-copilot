import { cx } from "./cx";

/**
 * One stable colour per mode-of-action group, so a repeat is visible at a
 * glance: three chips of the same colour in a row is the problem.
 */
const PALETTE = [
  { bg: "#e9eefb", fg: "#2c4a8a", dot: "#3f63b8" }, // blue
  { bg: "#f8e9e4", fg: "#8a3b22", dot: "#c2552f" }, // clay
  { bg: "#e5f2ec", fg: "#1d5e40", dot: "#2f8a5f" }, // green
  { bg: "#f3ebf8", fg: "#5f3480", dot: "#8550b0" }, // violet
  { bg: "#fbf1dc", fg: "#7a5100", dot: "#b07a12" }, // ochre
  { bg: "#e4f2f4", fg: "#195a63", dot: "#2a8794" }, // teal
  { bg: "#f9e8ef", fg: "#83294f", dot: "#b8466f" }, // rose
  { bg: "#eef0e2", fg: "#4f5a1c", dot: "#78872b" }, // olive
  { bg: "#ece9e4", fg: "#4b443a", dot: "#7a7062" }, // stone
];

const FIXED: Record<string, number> = {
  "IRAC:4A": 1, // neonicotinoids: clay (the usual suspect)
  "IRAC:28": 0,
  "IRAC:3A": 4,
  "IRAC:1B": 6,
  "IRAC:23": 5,
  "IRAC:12A": 3,
  "IRAC:29": 2,
  "IRAC:9D": 7,
  "FRAC:11": 3,
  "FRAC:3": 0,
  PHER: 2,
};

export function groupColor(code: string) {
  if (FIXED[code] !== undefined) return PALETTE[FIXED[code]];
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function MoaChip({ code, short, name, size = "md", className }: { code: string; short: string; name?: string; size?: "sm" | "md"; className?: string }) {
  const c = groupColor(code);
  const scheme = code.startsWith("FRAC") ? "FRAC" : code === "PHER" ? "" : "IRAC";
  return (
    <span
      title={name ? `${scheme} group ${short}: ${name}` : undefined}
      className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium", size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-[12px]", className)}
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: c.dot }} />
      {code === "PHER" ? "Pheromone" : `${scheme} ${short}`}
      {name && size === "md" ? <span className="font-normal opacity-75">· {name}</span> : null}
    </span>
  );
}

export const shortOf = (code: string) => (code.includes(":") ? code.split(":")[1] : code);

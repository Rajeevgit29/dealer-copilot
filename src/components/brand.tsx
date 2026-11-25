import Link from "next/link";
import { cx } from "./cx";

/** Mark: two arrows chasing each other — rotation. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cx("grid size-7 place-items-center rounded-lg bg-brand text-white", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 11a8 8 0 0 0-14.3-4.9" />
        <path d="M5 3v4h4" />
        <path d="M4 13a8 8 0 0 0 14.3 4.9" />
        <path d="M19 21v-4h-4" />
      </svg>
    </span>
  );
}

export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cx("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">Dealer Copilot</span>
    </Link>
  );
}

const NAV = [
  { href: "/counter", label: "Dealer counter" },
  { href: "/insights", label: "HQ insights" },
  { href: "/developers", label: "API" },
];

export function SiteNav({ active }: { active?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-1 text-[13.5px]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "rounded-lg px-2.5 py-1.5 transition-colors sm:px-3",
                active === n.href ? "bg-surface font-medium text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cx("text-[12px] leading-5 text-faint", className)}>
      Independent prototype, not affiliated with or endorsed by Syngenta or any company named. Approved uses from the CIB&amp;RC “Major Uses of
      Pesticides” list (as on 30 Sep 2026), which is for guidance only. Always follow the product label.
    </p>
  );
}

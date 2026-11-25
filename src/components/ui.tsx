"use client";

import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

import { cx } from "./cx";
export { cx };

// ---------------------------------------------------------------- Button
type ButtonVariant = "primary" | "secondary" | "ghost" | "brand" | "danger";
const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 disabled:bg-faint",
  brand: "bg-brand text-white hover:bg-brand-ink disabled:bg-faint",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-canvas disabled:text-faint",
  ghost: "text-ink-2 hover:bg-sunken disabled:text-faint",
  danger: "bg-surface text-bad border border-line hover:bg-bad-soft",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-[15px]",
        BUTTON[variant],
        className,
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Card
export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={cx("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)}>{children}</As>;
}

export function SectionTitle({ eyebrow, title, action, className }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{eyebrow}</div> : null}
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Inputs
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cx(
        "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-faint",
        "transition-colors focus:border-ink-2 focus:outline-none",
        className,
      )}
    />
  );
}

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
      <span>{children}</span>
      {hint ? <span className="font-normal text-faint">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="radiogroup" className={cx("inline-flex rounded-xl bg-sunken p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-8 rounded-lg px-3 text-[13px] font-medium transition-all",
            value === o.value ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Badges
type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "brand";
const TONE: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand-ink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium leading-4", TONE[tone], className)}>{children}</span>;
}

// ---------------------------------------------------------------- Spinner / Empty
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx("size-4 animate-spin text-muted", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-sunken", className)} />;
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon ? <div className="mb-3 grid size-10 place-items-center rounded-full bg-sunken text-muted">{icon}</div> : null}
      <div className="text-sm font-medium text-ink">{title}</div>
      {body ? <p className="mt-1 max-w-xs text-[13px] leading-5 text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Sheet (bottom sheet on phones, dialog on desktop)
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[92dvh] w-full animate-sheet-in flex-col rounded-t-3xl bg-surface shadow-[var(--shadow-pop)] outline-none sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Stat
export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tracking-tight tabular", tone === "good" && "text-good", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>{value}</div>
      {sub ? <div className="mt-0.5 text-[12px] text-muted">{sub}</div> : null}
    </div>
  );
}

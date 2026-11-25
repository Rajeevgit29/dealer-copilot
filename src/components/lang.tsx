"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { t as translate, type Lang, type StrKey } from "@/lib/i18n";
import { cx } from "./cx";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dc_lang");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved preference once after hydration
      if (saved === "hi" || saved === "en") setLangState(saved);
    } catch {}
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("dc_lang", l);
    } catch {}
  }, []);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(Ctx);
  const t = useCallback((key: StrKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  /** Pick the right side of an { en, hi } pair coming from the API. */
  const pick = useCallback((x: { en: string; hi: string }) => (lang === "hi" ? x.hi : x.en), [lang]);
  return { lang, setLang, t, pick };
}

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={cx("inline-flex rounded-lg bg-sunken p-0.5 text-[12px] font-medium", className)} role="radiogroup" aria-label="Language">
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={cx("h-7 rounded-md px-2.5 transition-all", lang === l ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink-2")}
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}

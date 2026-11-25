"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, RotateCcw, Store } from "lucide-react";
import { LogoMark } from "../brand";
import { LangToggle } from "../lang";
import { cx } from "../cx";
import { resetDemoFarmer, switchDealer } from "@/app/counter/actions";

interface DealerOpt {
  id: string;
  shop_name: string;
  name: string;
  district: string;
}

export function CounterHeader({ dealer, dealers }: { dealer: DealerOpt; dealers: DealerOpt[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" aria-label="Dealer Copilot home">
            <LogoMark />
          </Link>
          <div className="relative min-w-0">
            <button
              onClick={() => setOpen((o) => !o)}
              className={cx("flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left hover:bg-sunken", pending && "opacity-60")}
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold leading-4">{dealer.shop_name}</span>
                <span className="block truncate text-[11.5px] leading-4 text-muted">
                  {dealer.name} · {dealer.district}
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted" />
            </button>
            {open ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute left-0 top-11 z-50 max-h-80 w-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]" role="listbox">
                  <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Act as shop (demo)</div>
                  {dealers.map((d) => (
                    <button
                      key={d.id}
                      role="option"
                      aria-selected={d.id === dealer.id}
                      onClick={() => {
                        setOpen(false);
                        start(async () => {
                          await switchDealer(d.id);
                          router.push("/counter");
                          router.refresh();
                        });
                      }}
                      className={cx("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-canvas", d.id === dealer.id && "bg-canvas")}
                    >
                      <Store className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{d.shop_name}</span>
                        <span className="block truncate text-[11.5px] text-muted">{d.district}</span>
                      </span>
                    </button>
                  ))}
                  <div className="mt-1 border-t border-line pt-1">
                    <button
                      onClick={() => {
                        setOpen(false);
                        start(async () => {
                          await resetDemoFarmer();
                          router.push("/counter");
                          router.refresh();
                        });
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-canvas"
                    >
                      <RotateCcw className="size-4 shrink-0 text-muted" />
                      Reset demo farmer (98765 43210)
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/counter/traps" className="hidden rounded-lg px-2.5 py-1.5 text-[13px] text-muted hover:bg-sunken hover:text-ink sm:block">
            Traps
          </Link>
          <LangToggle />
        </div>
      </div>
    </header>
  );
}

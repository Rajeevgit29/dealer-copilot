"use client";

import { Plus, Receipt, ScanLine, ShieldAlert, PenLine, Trash2, Store } from "lucide-react";
import { Button, Card, Empty } from "../ui";
import { MoaChip, groupColor } from "../moa";
import { useLang } from "../lang";
import { cx } from "../cx";
import { groupName, groupShort } from "@/lib/ref-lite";
import { daysAgo, fmtDate, todayLocal } from "@/lib/format";

export interface Spray {
  id: string;
  sprayed_on: string;
  form_key: string;
  label: string;
  product_id: string | null;
  company: string | null;
  actives: string[];
  groups: string[];
  source: "scan" | "manual" | "sale" | "passport";
  dealer_id: string | null;
  shop_name: string | null;
}

/** Longest run of consecutive sprays (ending at the latest) that share a group. */
export function repeatStreak(sprays: Spray[]): { group: string; count: number; ids: Set<string> } | null {
  const s = [...sprays].sort((a, b) => a.sprayed_on.localeCompare(b.sprayed_on));
  const last = s.at(-1);
  if (!last) return null;
  let best: { group: string; count: number; ids: Set<string> } | null = null;
  for (const g of last.groups) {
    const ids = new Set([last.id]);
    let i = s.length - 2;
    let prev = last;
    while (i >= 0 && s[i].groups.includes(g) && daysAgo(s[i].sprayed_on, prev.sprayed_on) <= 30) {
      ids.add(s[i].id);
      prev = s[i];
      i--;
    }
    if (!best || ids.size > best.count) best = { group: g, count: ids.size, ids };
  }
  return best && best.count >= 2 ? best : null;
}

const SOURCE_ICON = { scan: ScanLine, sale: Receipt, manual: PenLine, passport: PenLine } as const;

export function PassportTimeline({
  sprays,
  currentDealerId,
  onAdd,
  onRemove,
}: {
  sprays: Spray[];
  currentDealerId: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const { t, lang } = useLang();
  const today = todayLocal();
  const sorted = [...sprays].sort((a, b) => b.sprayed_on.localeCompare(a.sprayed_on));
  const streak = repeatStreak(sprays);

  return (
    <Card as="section">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t("passport")}</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{t("passportSub")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onAdd} className="shrink-0">
          <Plus className="size-3.5" />
          {t("addSpray")}
        </Button>
      </div>

      {streak ? (
        <div className="mx-4 mb-3 flex animate-rise gap-3 rounded-xl border border-bad/15 bg-bad-soft px-3.5 py-3">
          <ShieldAlert className="mt-0.5 size-4.5 shrink-0 text-bad" />
          <div>
            <div className="text-[13.5px] font-semibold text-bad">
              {t("repeatAlert", { n: streak.count, g: `${streak.group.startsWith("FRAC") ? "FRAC" : "IRAC"} ${groupShort(streak.group)} (${groupName(streak.group)})` })}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-5 text-ink-2">{t("repeatAlertSub")}</p>
          </div>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <Empty icon={<ScanLine className="size-4.5" />} title={t("noSprays")} body={t("noSpraysBody")} action={<Button size="sm" onClick={onAdd}>{t("addSpray")}</Button>} />
      ) : (
        <ol className="px-4 pb-2">
          {sorted.map((s, i) => {
            const Icon = SOURCE_ICON[s.source] ?? PenLine;
            const inStreak = streak?.ids.has(s.id);
            const nextInStreak = inStreak && streak?.ids.has(sorted[i + 1]?.id ?? "");
            const dot = s.groups[0] ? groupColor(s.groups[0]).dot : "#a19d95";
            const otherShop = s.dealer_id && s.dealer_id !== currentDealerId && s.shop_name;
            return (
              <li key={s.id} className="group relative flex gap-3 pb-4">
                <div className="w-11 shrink-0 pt-0.5 text-right">
                  <div className="text-[12.5px] font-medium tabular">{fmtDate(s.sprayed_on, lang)}</div>
                  <div className="text-[10.5px] text-faint tabular">{daysAgo(s.sprayed_on, today)}d</div>
                </div>
                <div className="relative flex w-3 shrink-0 justify-center">
                  <span className="relative z-10 mt-1.5 size-3 rounded-full ring-4 ring-surface" style={{ background: dot }} />
                  {i < sorted.length - 1 ? (
                    <span className={cx("absolute top-4 bottom-[-6px] w-[2px] rounded-full", nextInStreak ? "bg-bad/40" : "bg-line")} />
                  ) : null}
                </div>
                <div className={cx("min-w-0 flex-1 rounded-xl px-3 py-2.5", inStreak ? "bg-bad-soft/50" : "bg-canvas")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{s.label}</div>
                      <div className="truncate text-[12px] capitalize text-muted">
                        {s.actives.join(" + ")}
                        {s.company ? ` · ${s.company}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span title={s.source} className="grid size-6 place-items-center rounded-md text-faint">
                        <Icon className="size-3.5" />
                      </span>
                      {s.source !== "sale" ? (
                        <button
                          onClick={() => onRemove(s.id)}
                          className="grid size-6 place-items-center rounded-md text-faint opacity-0 transition-opacity hover:bg-surface hover:text-bad focus:opacity-100 group-hover:opacity-100"
                          aria-label={t("remove")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {s.groups.map((g) => (
                      <MoaChip key={g} code={g} short={groupShort(g)} name={groupName(g)} size="sm" />
                    ))}
                    {otherShop ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                        <Store className="size-3" />
                        {s.shop_name}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

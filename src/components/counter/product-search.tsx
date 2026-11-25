"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input, Spinner } from "../ui";
import { MoaChip } from "../moa";
import { useLang } from "../lang";
import { api } from "@/lib/api-client";

export interface ProductHit {
  id: string;
  brand: string;
  company: string | null;
  generic: boolean;
  formulation: string;
  formKey: string;
  actives: string[];
  groups: { code: string; short: string; name: string }[];
}

export function ProductSearch({ onPick, autoFocus, placeholder }: { onPick: (p: ProductHit) => void; autoFocus?: boolean; placeholder?: string }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    if (q.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear results when the query is too short
      setHits(null);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<{ products: ProductHit[] }>(`/api/v1/products?q=${encodeURIComponent(q)}`)
        .then((r) => id === seq.current && setHits(r.products))
        .finally(() => id === seq.current && setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? t("searchPh")} className="pl-10" />
        {loading ? <Spinner className="absolute right-3.5 top-1/2 -translate-y-1/2" /> : null}
      </div>
      {hits ? (
        <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {hits.length === 0 ? <li className="px-3.5 py-3 text-[13px] text-muted">No registered product matches “{q}”.</li> : null}
          {hits.map((p) => (
            <li key={p.id}>
              <button onClick={() => onPick(p)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-canvas">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">
                    {p.generic ? p.formulation : p.brand}
                    {!p.generic && p.company ? <span className="font-normal text-muted"> · {p.company}</span> : null}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{p.generic ? "Any brand" : p.formulation}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {p.groups.map((g) => (
                    <MoaChip key={g.code} code={g.code} short={g.short} size="sm" />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium hover:bg-canvas"
    >
      <Printer className="size-3.5" />
      Print
    </button>
  );
}

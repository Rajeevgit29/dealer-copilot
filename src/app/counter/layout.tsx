import type { Metadata } from "next";
import { districtById } from "@/engine";
import { LangProvider } from "@/components/lang";
import { CounterHeader } from "@/components/counter/header";
import { dealerId } from "@/lib/http";
import { getDealer, listDealers } from "@/lib/repo";

export const metadata: Metadata = { title: { default: "Dealer counter", template: "%s · Dealer Copilot" } };
export const dynamic = "force-dynamic";

export default async function CounterLayout({ children }: LayoutProps<"/counter">) {
  const [dealer, dealers] = await Promise.all([getDealer(await dealerId()), listDealers()]);
  const all = dealers
    .filter((d) => d.id.endsWith("-1"))
    .map((d) => ({ id: d.id, shop_name: d.shop_name, name: d.name, district: districtById(d.district_id)?.name ?? d.district_id }));
  const current = dealer ?? dealers[0];
  return (
    <LangProvider>
      <CounterHeader
        dealer={{ id: current.id, shop_name: current.shop_name, name: current.name, district: districtById(current.district_id)?.name ?? current.district_id }}
        dealers={all}
      />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-5">{children}</main>
    </LangProvider>
  );
}

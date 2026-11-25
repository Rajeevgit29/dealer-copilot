import { districtById } from "@/engine";
import { TrapLog } from "@/components/counter/traps";
import { dealerId } from "@/lib/http";
import { getDealer, listDealers } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pheromone traps" };

export default async function TrapsPage() {
  const dealer = (await getDealer(await dealerId())) ?? (await listDealers())[0];
  return <TrapLog districtId={dealer.district_id} districtName={districtById(dealer.district_id)?.name ?? dealer.district_id} />;
}

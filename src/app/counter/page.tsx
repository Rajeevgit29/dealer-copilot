import { districtById } from "@/engine";
import { CounterHome } from "@/components/counter/home";
import { dealerId } from "@/lib/http";
import { dealerToday, getDealer, listDealers, recentConsultations } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function CounterPage() {
  const dealer = (await getDealer(await dealerId())) ?? (await listDealers())[0];
  const [stats, recent] = await Promise.all([dealerToday(dealer.id), recentConsultations(dealer.id, 8)]);
  const district = districtById(dealer.district_id);
  return (
    <CounterHome
      dealerName={dealer.name}
      districtId={dealer.district_id}
      districtName={district?.name ?? dealer.district_id}
      hasCotton={!!district?.crops.includes("cotton")}
      stats={stats ?? { consultations: 0, sales: 0, prevented: 0 }}
      recent={recent.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }))}
    />
  );
}

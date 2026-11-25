import { groupsFor, searchProducts } from "@/engine";
import { handle, json } from "@/lib/http";

export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const products = searchProducts(q, 15).map((p) => ({
    id: p.id,
    brand: p.brand,
    company: p.company,
    generic: p.generic,
    formulation: p.formulation,
    formKey: p.formKey,
    actives: p.actives.map((a) => a.name),
    groups: groupsFor(p.actives.map((a) => a.name)).map((g) => ({ code: g.code, short: g.short, name: g.name })),
  }));
  return json({ products });
});

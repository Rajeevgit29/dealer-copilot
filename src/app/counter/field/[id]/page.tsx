import { notFound } from "next/navigation";
import { FieldWorkspace } from "@/components/counter/field-workspace";
import { aiEnabled } from "@/lib/gemini";
import { dealerId } from "@/lib/http";
import { getField } from "@/lib/repo";
import { SAMPLE_BOTTLES } from "@/lib/samples";

export const dynamic = "force-dynamic";

export default async function FieldPage(props: PageProps<"/counter/field/[id]">) {
  const { id } = await props.params;
  const data = await getField(id);
  if (!data) notFound();
  return (
    <FieldWorkspace
      initial={data}
      dealerId={await dealerId()}
      aiEnabled={aiEnabled()}
      samples={SAMPLE_BOTTLES.map(({ id, title, subtitle, tone }) => ({ id, title, subtitle, tone }))}
    />
  );
}

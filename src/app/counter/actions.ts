"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDealer, resetDemo } from "@/lib/repo";

/** Demo only: switch which shop the counter app is acting as. */
export async function switchDealer(dealerId: string) {
  if (!(await getDealer(dealerId))) return;
  (await cookies()).set("dc_dealer", dealerId, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 90 });
  revalidatePath("/counter", "layout");
}

/** Demo only: restore the walkthrough farmer's three-neonicotinoid history. */
export async function resetDemoFarmer() {
  await resetDemo();
  revalidatePath("/counter", "layout");
}

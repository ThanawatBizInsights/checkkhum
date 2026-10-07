"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/server/crm/action";
import { getCustomerState } from "@/lib/server/customer-auth";

const renewalSchema = z.object({
  policy_id: z.uuid(),
  message: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(1000, "ข้อความยาวเกิน 1000 ตัวอักษร").optional()),
});

/**
 * "ขอต่ออายุ" on a policy. The database function checks that the policy
 * belongs to the signed-in customer and returns the open request if one
 * already exists, so a double click never opens two.
 */
export async function requestRenewal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const state = await getCustomerState();
  if (state.kind !== "customer") return { ok: false, message: "กรุณาเข้าสู่ระบบอีกครั้ง" };
  if (!state.customer.linked) return { ok: false, message: "บัญชียังไม่ได้เชื่อมกับข้อมูลลูกค้า ติดต่อทีมงานทาง LINE" };

  const parsed = renewalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { data, error } = await state.customer.db.rpc("portal_request_renewal", {
    p_policy_id: parsed.data.policy_id,
    p_message: parsed.data.message,
  });
  if (error) {
    if (error.code === "P0001" || error.code === "P0002") return { ok: false, message: error.message };
    console.error(`[portal] renewal request failed ${error.code}`);
    return { ok: false, message: "ส่งคำขอไม่สำเร็จ ลองอีกครั้ง หรือติดต่อทาง LINE" };
  }
  const result = data as { reference: string; duplicate: boolean };
  revalidatePath("/customer");
  return {
    ok: true,
    message: result.duplicate
      ? `มีคำขอต่ออายุอยู่แล้ว เลขอ้างอิง ${result.reference} ทีมงานกำลังดำเนินการ`
      : `ส่งคำขอต่ออายุแล้ว เลขอ้างอิง ${result.reference} ทีมงานจะติดต่อกลับพร้อมใบเสนอราคา`,
  };
}

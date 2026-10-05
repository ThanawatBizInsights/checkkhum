import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { PermissionError, requireRole, type StaffContext } from "../staff-auth";

export type ActionResult = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
};

/** Thai message for a database error, without leaking internals. */
export function dbErrorMessage(error: Pick<PostgrestError, "code" | "message">): string {
  switch (error.code) {
    case "42501":
      return "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้";
    case "P0001":
    case "P0002":
      return error.message; // our own trigger/function messages, already in Thai
    case "23505":
      return "มีข้อมูลนี้อยู่แล้ว";
    case "23503":
      return "รายการที่อ้างถึงไม่มีอยู่หรือถูกใช้งานอยู่";
    case "23514":
    case "22P02":
    case "22007":
    case "22008":
      return "ข้อมูลบางช่องไม่ถูกต้อง";
    default:
      return "บันทึกไม่สำเร็จ ลองอีกครั้ง";
  }
}

export class ActionFailure extends Error {}

/** Throw for a database error; also treats "0 rows changed" (RLS) as no permission. */
export function check<R extends { data: unknown; error: PostgrestError | null }>(
  result: R,
  opts: { expectRows?: boolean } = {},
): NonNullable<R["data"]> {
  if (result.error) {
    if (!["42501", "P0001", "P0002", "23505", "23503", "23514"].includes(result.error.code)) {
      console.error(`[crm] db error ${result.error.code}`);
    }
    throw new ActionFailure(dbErrorMessage(result.error));
  }
  if (result.data == null || (opts.expectRows && Array.isArray(result.data) && result.data.length === 0)) {
    throw new ActionFailure("ไม่พบรายการ หรือบัญชีนี้ไม่มีสิทธิ์แก้ไข");
  }
  return result.data as NonNullable<R["data"]>;
}

/**
 * Wraps a server action: checks the caller's role, validates the form with
 * zod, runs the body, and turns failures into a Thai message for the form.
 */
export async function runAction<S extends z.ZodType>(
  min: "viewer" | "agent" | "admin",
  schema: S,
  formData: FormData,
  body: (input: z.infer<S>, staff: StaffContext) => Promise<string | void>,
): Promise<ActionResult> {
  let staff: StaffContext;
  try {
    staff = await requireRole(min);
  } catch (e) {
    return { ok: false, message: e instanceof PermissionError ? e.message : "กรุณาเข้าสู่ระบบอีกครั้ง" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, message: "ข้อมูลบางช่องยังไม่ถูกต้อง", fieldErrors };
  }

  try {
    const message = await body(parsed.data, staff);
    return { ok: true, message: message ?? "บันทึกแล้ว" };
  } catch (e) {
    if (e instanceof ActionFailure || e instanceof PermissionError) return { ok: false, message: e.message };
    // Next.js redirect()/notFound() throw special errors that must propagate.
    throw e;
  }
}

// ---- Reusable zod field helpers (form values arrive as strings) ----------

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const f = {
  uuid: (msg = "เลือกรายการ") => z.uuid({ error: msg }),
  optionalUuid: () => z.preprocess(blankToUndefined, z.uuid().optional()),
  text: (max: number, msg: string) => z.string({ error: msg }).trim().min(1, msg).max(max, `ยาวเกิน ${max} ตัวอักษร`),
  optionalText: (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max, `ยาวเกิน ${max} ตัวอักษร`).optional()),
  date: (msg = "เลือกวันที่") => z.string({ error: msg }).regex(/^\d{4}-\d{2}-\d{2}$/, msg),
  optionalDate: () => z.preprocess(blankToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง").optional()),
  money: (msg = "กรอกจำนวนเงิน") =>
    z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/,/g, "")) : v), z.number({ error: msg }).min(0, msg).max(100_000_000, msg)),
  optionalMoney: () =>
    z.preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.replace(/,/g, ""))) : v),
      z.number({ error: "จำนวนเงินไม่ถูกต้อง" }).min(0).max(100_000_000).optional(),
    ),
  phone: () =>
    z
      .string({ error: "กรอกเบอร์โทร" })
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => /^0\d{8,9}$/.test(v), "กรอกเบอร์โทร 9–10 หลักที่ขึ้นต้นด้วย 0"),
  checkbox: () => z.preprocess((v) => v === "on" || v === "true", z.boolean()),
};

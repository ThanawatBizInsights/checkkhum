"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { ActionFailure, check, f, runAction, type ActionResult } from "@/lib/server/crm/action";
import { getBackendConfig } from "@/lib/server/env";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

/*
 * Customer portal administration from the CRM. Every action declares its
 * minimum role and writes through the staff member's own client, so RLS
 * applies (invitations and documents: agents and admins; unlinking: admins).
 */

async function siteOrigin(): Promise<string | undefined> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : undefined;
}

export async function inviteCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    customer_id: f.uuid(),
    email: z.email({ error: "กรอกอีเมลลูกค้าให้ถูกต้อง" }).trim().toLowerCase(),
  });
  return runAction("agent", schema, formData, async ({ customer_id, email }, staff) => {
    const config = getBackendConfig();
    if (config.mode !== "database") throw new ActionFailure("ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY");

    const [{ data: linked }, { data: staffEmail }] = await Promise.all([
      staff.db.from("customer_accounts").select("id").eq("customer_id", customer_id).maybeSingle(),
      staff.db.from("staff_users").select("id").eq("email", email).maybeSingle(),
    ]);
    if (linked) throw new ActionFailure("ลูกค้ารายนี้มีบัญชีที่เชื่อมแล้ว");
    if (staffEmail) throw new ActionFailure("อีเมลนี้เป็นบัญชีเจ้าหน้าที่ ใช้เป็นบัญชีลูกค้าไม่ได้");

    // Replace any open invitation, then record the new one as this staff
    // member (RLS: agents and admins only). This record is what authorises
    // the login to be linked to this customer later.
    check(
      await staff.db
        .from("customer_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("customer_id", customer_id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .select("id"),
    );
    const invitation = check(await staff.db.from("customer_invitations").insert({ customer_id, email }).select("id").single());

    // Sending the email needs the Auth admin API (secret key). Only reached
    // after the caller's role was checked and the invitation was accepted by RLS.
    const admin = getSupabaseAdmin(config.supabaseUrl, config.secretKey);
    const origin = await siteOrigin();
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin ? `${origin}/customer/auth/confirm` : undefined,
    });
    revalidatePath(`/staff/customers/${customer_id}`);

    if (error?.code === "email_exists") {
      return `อีเมลนี้มีบัญชีอยู่แล้ว ให้ลูกค้าเข้าสู่ระบบที่หน้า “เข้าสู่ระบบลูกค้า” (หรือใช้ “ลืมรหัสผ่าน”) ระบบจะเชื่อมข้อมูลให้เมื่อเข้าสู่ระบบ`;
    }
    if (error) {
      console.error(`[portal] invite email failed ${error.code ?? error.status}`);
      await staff.db.from("customer_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitation.id);
      throw new ActionFailure(
        error.status === 429 ? "ส่งอีเมลบ่อยเกินไป รอสักครู่แล้วลองใหม่" : "ส่งอีเมลเชิญไม่สำเร็จ ตรวจอีเมลแล้วลองอีกครั้ง",
      );
    }
    return `ส่งคำเชิญไปที่ ${email} แล้ว ลิงก์ในอีเมลจะให้ลูกค้ายืนยันอีเมลและตั้งรหัสผ่าน`;
  });
}

export async function revokeInvitation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ id: f.uuid(), customer_id: f.uuid() });
  return runAction("agent", schema, formData, async ({ id, customer_id }, staff) => {
    check(
      await staff.db.from("customer_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null).select("id"),
      { expectRows: true },
    );
    revalidatePath(`/staff/customers/${customer_id}`);
    return "ยกเลิกคำเชิญแล้ว";
  });
}

export async function unlinkCustomerAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ id: f.uuid(), customer_id: f.uuid() });
  return runAction("admin", schema, formData, async ({ id, customer_id }, staff) => {
    check(await staff.db.from("customer_accounts").delete().eq("id", id).select("id"), { expectRows: true });
    revalidatePath(`/staff/customers/${customer_id}`);
    return "ยกเลิกการเชื่อมบัญชีแล้ว ลูกค้าจะไม่เห็นข้อมูลนี้อีก";
  });
}

// ---- Policy documents ------------------------------------------------------

const MAX_BYTES = 10 * 1024 * 1024;

/** File type from its first bytes, not from the browser's claim. */
async function sniff(file: File): Promise<{ type: string; ext: string } | null> {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { type: "application/pdf", ext: "pdf" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  return null;
}

export async function uploadPolicyDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    policy_id: f.uuid(),
    kind: z.enum(["policy", "receipt", "endorsement", "other"], { error: "เลือกประเภทเอกสาร" }),
    title: f.text(120, "ตั้งชื่อเอกสาร"),
    visible_to_customer: f.checkbox(),
    file: z.instanceof(File, { error: "เลือกไฟล์" }),
  });
  return runAction("agent", schema, formData, async (input, staff) => {
    if (input.file.size === 0) throw new ActionFailure("เลือกไฟล์");
    if (input.file.size > MAX_BYTES) throw new ActionFailure("ไฟล์ใหญ่เกิน 10 MB");
    const kind = await sniff(input.file);
    if (!kind) throw new ActionFailure("รับเฉพาะไฟล์ PDF, JPG หรือ PNG");

    const id = crypto.randomUUID();
    const path = `${input.policy_id}/${id}.${kind.ext}`;
    // Upload with the staff member's own session (storage policy: agents/admins).
    const { error: uploadError } = await staff.db.storage
      .from("policy-documents")
      .upload(path, input.file, { contentType: kind.type, upsert: false });
    if (uploadError) {
      console.error(`[portal] upload failed ${uploadError.name}`);
      throw new ActionFailure("อัปโหลดไม่สำเร็จ ลองอีกครั้ง");
    }

    const { error } = await staff.db.from("policy_documents").insert({
      id,
      policy_id: input.policy_id,
      kind: input.kind,
      title: input.title,
      storage_path: path,
      content_type: kind.type,
      size_bytes: input.file.size,
      visible_to_customer: input.visible_to_customer,
    });
    if (error) {
      await staff.db.storage.from("policy-documents").remove([path]);
      check({ data: null, error });
    }
    revalidatePath(`/staff/policies/${input.policy_id}`);
    return input.visible_to_customer ? "อัปโหลดแล้ว ลูกค้าเห็นเอกสารนี้ในบัญชีของเขา" : "อัปโหลดแล้ว ยังไม่แสดงให้ลูกค้า";
  });
}

export async function setDocumentVisibility(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ id: f.uuid(), policy_id: f.uuid(), visible: z.enum(["true", "false"]).transform((v) => v === "true") });
  return runAction("agent", schema, formData, async ({ id, policy_id, visible }, staff) => {
    check(await staff.db.from("policy_documents").update({ visible_to_customer: visible }).eq("id", id).select("id"), { expectRows: true });
    revalidatePath(`/staff/policies/${policy_id}`);
    return visible ? "อนุมัติแล้ว ลูกค้าเห็นเอกสารนี้" : "ซ่อนจากลูกค้าแล้ว";
  });
}

export async function deletePolicyDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ id: f.uuid(), policy_id: f.uuid() });
  return runAction("agent", schema, formData, async ({ id, policy_id }, staff) => {
    const [doc] = check(await staff.db.from("policy_documents").delete().eq("id", id).select("storage_path"), { expectRows: true });
    const { error } = await staff.db.storage.from("policy-documents").remove([doc.storage_path]);
    if (error) console.error(`[portal] file remove failed ${error.name}`);
    revalidatePath(`/staff/policies/${policy_id}`);
    return "ลบเอกสารแล้ว";
  });
}

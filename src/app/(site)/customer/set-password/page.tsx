import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, FormField } from "@/components/customer/auth-card";
import { ActionForm } from "@/components/staff/action-form";
import { sessionFromEmailLink } from "@/lib/server/customer-auth";
import { createUserClient } from "@/lib/server/supabase-user";
import { setNewPassword } from "../_actions/auth";

export const metadata: Metadata = { title: "ตั้งรหัสผ่าน", robots: { index: false, follow: false } };

/** Reached from an invitation or reset email (the link signs the visitor in first). */
export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const db = await createUserClient();
  const { data } = db ? await db.auth.getUser() : { data: { user: null } };
  if (!data.user || !db || !(await sessionFromEmailLink(db))) redirect("/customer/login?error=link");
  const invited = (await searchParams).mode === "invite";

  return (
    <AuthCard
      title={invited ? "ยินดีต้อนรับ ตั้งรหัสผ่าน" : "ตั้งรหัสผ่านใหม่"}
      intro={
        invited
          ? `ยืนยันอีเมล ${data.user.email} แล้ว ตั้งรหัสผ่านสำหรับเข้าสู่ระบบครั้งต่อไป`
          : `ตั้งรหัสผ่านใหม่สำหรับ ${data.user.email}`
      }
    >
      <ActionForm action={setNewPassword} submitLabel="บันทึกรหัสผ่าน" pendingLabel="กำลังบันทึก" size="md" className="mt-5 grid gap-4">
        <FormField
          id="password"
          name="password"
          type="password"
          label="รหัสผ่านใหม่"
          autoComplete="new-password"
          minLength={10}
          required
          hint="อย่างน้อย 10 ตัวอักษร ใช้ประโยคที่จำง่ายแต่เดายากก็ได้"
        />
        <FormField id="confirm" name="confirm" type="password" label="ยืนยันรหัสผ่านใหม่" autoComplete="new-password" required />
      </ActionForm>
    </AuthCard>
  );
}

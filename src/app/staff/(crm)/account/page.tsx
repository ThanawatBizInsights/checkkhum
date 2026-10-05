import type { Metadata } from "next";
import { ActionForm } from "@/components/staff/action-form";
import { Field, KeyValue, PageTitle, Sheet } from "@/components/staff/ui";
import { roleLabels } from "@/lib/crm-labels";
import { requireStaff } from "@/lib/server/staff-auth";
import { changePassword } from "../../_actions/auth";

export const metadata: Metadata = { title: "บัญชีของฉัน" };

export default async function AccountPage() {
  const staff = await requireStaff();
  return (
    <>
      <PageTitle title="บัญชีของฉัน" />
      <div className="grid max-w-[40rem] gap-5">
        <Sheet>
          <KeyValue items={[["ชื่อ", staff.fullName], ["อีเมล", staff.email], ["สิทธิ์", roleLabels[staff.role]]]} />
        </Sheet>
        <Sheet title="เปลี่ยนรหัสผ่าน" id="pw-title">
          <ActionForm action={changePassword} submitLabel="เปลี่ยนรหัสผ่าน" resetOnSuccess>
            <Field label="รหัสผ่านปัจจุบัน" htmlFor="current">
              <input id="current" name="current" type="password" required autoComplete="current-password" className="field-input" />
            </Field>
            <Field label="รหัสผ่านใหม่" htmlFor="password" hint="อย่างน้อย 12 ตัวอักษร">
              <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className="field-input" />
            </Field>
            <Field label="ยืนยันรหัสผ่านใหม่" htmlFor="confirm">
              <input id="confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password" className="field-input" />
            </Field>
          </ActionForm>
        </Sheet>
      </div>
    </>
  );
}

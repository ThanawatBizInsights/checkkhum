import { NextResponse, type NextRequest } from "next/server";
import { getStaffState } from "@/lib/server/staff-auth";

/** Staff download of a policy document (any status). RLS + storage policies: staff only. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const noStore = { "Cache-Control": "no-store" };
  const state = await getStaffState();
  if (state.kind !== "staff") return NextResponse.redirect(new URL("/staff/login", request.url), { headers: noStore });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("ไม่พบเอกสาร", { status: 404, headers: noStore });

  const { db } = state.staff;
  const { data: doc } = await db.from("policy_documents").select("id, kind, storage_path").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("ไม่พบเอกสาร", { status: 404, headers: noStore });

  const ext = doc.storage_path.split(".").pop();
  const { data: signed } = await db.storage
    .from("policy-documents")
    .createSignedUrl(doc.storage_path, 60, { download: `checkkhum-${doc.kind}-${doc.id.slice(0, 8)}.${ext}` });
  if (!signed) return new NextResponse("ไม่พบเอกสาร", { status: 404, headers: noStore });
  return NextResponse.redirect(signed.signedUrl, { headers: noStore });
}

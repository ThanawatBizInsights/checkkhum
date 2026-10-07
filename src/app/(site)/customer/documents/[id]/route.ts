import { NextResponse, type NextRequest } from "next/server";
import { getCustomerState } from "@/lib/server/customer-auth";

/**
 * Download one of the signed-in customer's approved documents. The row and
 * the file are read with the customer's own session, so row level security
 * (policy_documents) and storage policies decide; another customer's id
 * simply isn't found. The signed URL lives for 60 seconds.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const noStore = { "Cache-Control": "no-store" };
  const state = await getCustomerState();
  if (state.kind !== "customer") return NextResponse.redirect(new URL("/customer/login", request.url), { headers: noStore });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("ไม่พบเอกสาร", { status: 404, headers: noStore });

  const { db } = state.customer;
  const { data: doc } = await db.from("policy_documents").select("id, kind, storage_path").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("ไม่พบเอกสาร", { status: 404, headers: noStore });

  const ext = doc.storage_path.split(".").pop();
  const { data: signed, error } = await db.storage
    .from("policy-documents")
    .createSignedUrl(doc.storage_path, 60, { download: `checkkhum-${doc.kind}-${doc.id.slice(0, 8)}.${ext}` });
  if (error || !signed) return new NextResponse("ไม่พบเอกสาร", { status: 404, headers: noStore });

  return NextResponse.redirect(signed.signedUrl, { headers: noStore });
}

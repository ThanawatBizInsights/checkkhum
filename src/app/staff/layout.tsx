import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "ระบบพนักงาน", template: "%s | ระบบพนักงานเช็กคุ้ม" },
  robots: { index: false, follow: false },
};

/** Staff area: separate from the public site chrome, never indexed. */
export default function StaffRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-sky">{children}</div>;
}

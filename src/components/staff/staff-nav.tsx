"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; badge?: number };

/** Sidebar on desktop, a horizontally scrolling tab row on phones. */
export function StaffNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูระบบพนักงาน" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const current = item.href === "/staff" ? pathname === "/staff" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center justify-between gap-3 whitespace-nowrap rounded-[var(--radius-control)] px-3 font-semibold ${
                  current ? "bg-paper text-navy" : "text-paper/85 hover:bg-paper/10 hover:text-paper"
                }`}
              >
                {item.label}
                {item.badge ? (
                  <span className={`rounded-full px-2 text-sm ${current ? "bg-teal text-paper" : "bg-teal/90 text-paper"}`}>{item.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

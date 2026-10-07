import { AccountMenu } from "./account-menu";
import { ButtonLink } from "./button";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="relative border-b border-line bg-paper">
      <div className="wrap flex items-center justify-between gap-4 py-2.5">
        <Logo />
        <nav aria-label="เมนูหลัก" className="hidden lg:block">
          <NavLinks className="flex items-center gap-1" linkClassName="rounded-lg px-3 py-2 font-semibold text-navy hover:bg-sky" />
        </nav>
        <div className="flex items-center gap-2">
          <AccountMenu />
          <ButtonLink href="/quote" size="sm">
            ขอใบเสนอราคา
          </ButtonLink>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

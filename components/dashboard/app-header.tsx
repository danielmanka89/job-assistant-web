import { Logo } from "@/components/brand";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { NavLinks } from "./nav-links";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-8">
          <Logo />
          <div className="hidden sm:block">
            <NavLinks />
          </div>
        </div>
        <LogoutButton />
      </div>
      <div className="border-t border-neutral-100 px-4 py-2 sm:hidden dark:border-neutral-800">
        <NavLinks />
      </div>
    </header>
  );
}

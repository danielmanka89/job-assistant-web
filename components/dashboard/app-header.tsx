import { Logo } from "@/components/brand";
import { LogoutButton } from "@/app/dashboard/logout-button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <LogoutButton />
      </div>
    </header>
  );
}

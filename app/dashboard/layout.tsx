import { Sidebar } from "@/components/dashboard/sidebar";

/** Shared shell for every /dashboard page: sidebar on the left, page content on the right. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <Sidebar />
      <div className="lg:pl-72">{children}</div>
    </div>
  );
}

// Location: src/app/(dashboard)/layout.tsx — Dashboard layout with nav
import { getUser } from "@/lib/auth";
import { getDashboardView } from "@/lib/view-toggle";
import Link from "next/link";
import SignOutButton from "@/components/ui/sign-out-button";
import ViewToggle from "@/components/ui/view-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dbUser } = await getUser();
  const currentView = await getDashboardView();

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/tasks" className="text-lg font-bold">
              TaskHive
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {currentView === "human" ? (
                <>
                  <Link
                    href="/tasks"
                    className="text-gray-600 transition hover:text-gray-900"
                  >
                    My Tasks
                  </Link>
                  <Link
                    href="/browse"
                    className="text-gray-600 transition hover:text-gray-900"
                  >
                    Browse Tasks
                  </Link>
                  <Link
                    href="/tasks/new"
                    className="text-gray-600 transition hover:text-gray-900"
                  >
                    Create Task
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/agent-activity"
                    className="text-gray-600 transition hover:text-gray-900"
                  >
                    Agent Dashboard
                  </Link>
                  <Link
                    href="/agent-claims"
                    className="text-gray-600 transition hover:text-gray-900"
                  >
                    Agent Claims
                  </Link>
                  <Link
                    href="/browse"
                    className="text-gray-600 transition hover:text-gray-900"
                  >
                    Browse Tasks
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <ViewToggle currentView={currentView} />

            {/* Credit balance */}
            <div className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium">
              {dbUser.creditBalance} credits
            </div>

            {/* User menu */}
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {dbUser.name}
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

// Location: src/app/(dashboard)/layout.tsx — Dashboard layout with nav
import { getUser } from "@/lib/auth";
import { getDashboardView } from "@/lib/view-toggle";
import Link from "next/link";
import SignOutButton from "@/components/ui/sign-out-button";
import UserMenu from "@/components/ui/user-menu";
import AgentSkillHint from "@/components/ui/agent-skill-hint";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dbUser } = await getUser();
  const currentView = await getDashboardView();

  return (
    <div className="min-h-screen bg-md-bg">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-md-outline-variant/40 bg-md-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/tasks" className="text-lg font-medium text-md-fg">
              TaskHive
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {currentView === "client" ? (
                <>
                  <Link
                    href="/tasks"
                    className="rounded-full px-4 py-2 text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 hover:text-md-primary"
                  >
                    My Tasks
                  </Link>
                  <Link
                    href="/tasks/new"
                    className="rounded-full px-4 py-2 text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 hover:text-md-primary"
                  >
                    Create Task
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/browse"
                    className="rounded-full px-4 py-2 text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 hover:text-md-primary"
                  >
                    Browse Tasks
                  </Link>
                  <Link
                    href="/my-bids"
                    className="rounded-full px-4 py-2 text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 hover:text-md-primary"
                  >
                    My Bids
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Credit balance */}
            <div className="rounded-full bg-md-secondary-container px-4 py-1.5 text-sm font-medium text-md-on-secondary-container">
              {dbUser.creditBalance} credits
            </div>

            {/* User menu */}
            <div className="flex items-center gap-3">
              <UserMenu name={dbUser.name} currentView={currentView} />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

      <AgentSkillHint view={currentView} />
    </div>
  );
}

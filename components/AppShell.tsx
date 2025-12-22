import type { ReactNode } from "react";
import type { Profile } from "@/lib/types";
import { Header } from "@/components/Header";
import { UsersSidebarFixed } from "@/components/UsersSidebarFixed";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  return (
    <div className="wm-bg min-h-dvh">
      <Header profile={profile} />

      <div className="mx-auto flex w-full max-w-6xl gap-4 px-4 pb-20 pt-4">
        <aside className="hidden lg:block w-[320px] shrink-0">
          <div className="sticky top-20">
            <UsersSidebarFixed />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="w-full max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}



import type { ReactNode } from "react";
import type { Profile } from "@/lib/types";
import { Header } from "@/components/Header";
import { NavSidebarFixed } from "@/components/NavSidebarFixed";
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

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 pb-20 pt-4 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_320px]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <NavSidebarFixed />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="w-full max-w-3xl">{children}</div>
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <UsersSidebarFixed />
          </div>
        </aside>
      </div>
    </div>
  );
}



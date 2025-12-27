"use client";

import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import type { Profile } from "@/lib/types";
import { Header } from "@/components/Header";
import { NavSidebarFixed } from "@/components/NavSidebarFixed";
import { UsersSidebarFixed } from "@/components/UsersSidebarFixed";

export function AppShell({
  profile,
  children,
  bgImageUrl,
}: {
  profile: Profile;
  children: ReactNode;
  bgImageUrl?: string;
}) {
  return (
    <div
      className="wm-bg min-h-dvh"
      style={
        bgImageUrl
          ? ({ ["--wm-bg-image" as never]: `url('${bgImageUrl}')` } as CSSProperties)
          : undefined
      }
    >
      <NavSidebarFixed profile={profile} />

      <div className="lg:pl-64">
        <Header profile={profile} />

        <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0">
              <div className="w-full max-w-4xl">{children}</div>
            </div>

            <aside className="hidden xl:block">
              <div className="sticky top-24">
                <UsersSidebarFixed />
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}



"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, Menu, Search, Users, Layers } from "lucide-react";
import type { Profile } from "@/lib/types";
import { NotificationsBell } from "@/components/NotificationsBell";

export function Header({ profile }: { profile: Profile }) {
  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 h-20 border-b border-black/10 bg-white/60 backdrop-blur-xl">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="rounded-xl p-2 hover:bg-black/[0.06] lg:hidden" aria-label="Menu">
            <Menu className="h-5 w-5 text-black" />
          </button>

          <div className="min-w-0">
            <Link href="/" className="block truncate text-xl font-extrabold tracking-tight text-black">
              Work Management
            </Link>
            <div className="truncate text-sm text-black/60">
              {profile.full_name ?? "User"} • {profile.role.replaceAll("_", " ")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search (UI only) */}
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
            <input
              type="text"
              placeholder="Tìm kiếm công việc..."
              className="h-11 w-64 rounded-2xl border border-black/10 bg-white/70 pl-10 pr-4 text-sm text-black outline-none placeholder:text-black/40 hover:bg-white focus:bg-white"
            />
          </div>

          {/* Quick links on mobile */}
          <Link href="/dashboard" className="wm-btn h-11 rounded-2xl px-3 lg:hidden">
            <LayoutDashboard className="h-4 w-4" />
          </Link>
          <Link href="/team" className="wm-btn h-11 rounded-2xl px-3 lg:hidden">
            <Users className="h-4 w-4" />
          </Link>
          <Link href="/workspace" className="wm-btn h-11 rounded-2xl px-3 lg:hidden">
            <Layers className="h-4 w-4" />
          </Link>

          <div>
            <NotificationsBell />
          </div>

          <button
            onClick={logout}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-4 text-sm font-semibold text-black hover:bg-white"
            type="button"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
}

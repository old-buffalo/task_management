"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, Users, Layers } from "lucide-react";
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
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[rgba(10,14,26,0.55)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <Link href="/" className="block truncate text-sm font-semibold tracking-tight text-white">
            Work Management
          </Link>
          <div className="truncate text-xs text-[rgba(232,235,245,0.72)]">
            {profile.full_name ?? "User"} • {profile.role.replaceAll("_", " ")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="wm-btn h-9 shrink-0 whitespace-nowrap rounded-xl px-3 lg:hidden"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/team"
            className="wm-btn h-9 shrink-0 whitespace-nowrap rounded-xl px-3 lg:hidden"
          >
            <Users className="h-4 w-4" />
            Team
          </Link>
          <Link
            href="/workspace"
            className="wm-btn h-9 shrink-0 whitespace-nowrap rounded-xl px-3 lg:hidden"
          >
            <Layers className="h-4 w-4" />
            Workspace
          </Link>
          <div className="lg:hidden">
            <NotificationsBell />
          </div>
          <button
            onClick={logout}
            className="wm-btn h-9 shrink-0 whitespace-nowrap rounded-xl px-3"
            type="button"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}



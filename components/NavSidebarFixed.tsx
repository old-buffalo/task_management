"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CheckSquare, FolderKanban, LayoutDashboard, Layers, Users } from "lucide-react";
import type { Profile } from "@/lib/types";

export function NavSidebarFixed({ profile }: { profile: Profile }) {
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/workspace", label: "Workspace", icon: FolderKanban },
    { href: "/", label: "Công việc", icon: CheckSquare },
    { href: "/team", label: "Nhóm", icon: Users },
    { href: "/tasks", label: "Lọc nâng cao", icon: BarChart3 },
  ] as const;

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-64 flex-col border-r border-black/10 bg-white/60 backdrop-blur-xl lg:flex">
      {/* Logo */}
      <div className="border-b border-black/10 p-6">
        <div className="flex items-center gap-3">
          <div className="wm-gradient-primary shadow-[var(--wm-shadow-glow)] flex h-10 w-10 items-center justify-center rounded-2xl">
            <CheckSquare className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-extrabold tracking-tight text-black">ipa05</div>
            <div className="truncate text-xs text-black/60">Quản lý công việc</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {items.map((it) => {
          const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                active ? "wm-gradient-primary text-white shadow-[var(--wm-shadow-glow)]" : "text-black/70 hover:bg-black/[0.06] hover:text-black"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      <div className="border-t border-black/10 p-4">
        <div className="rounded-2xl bg-black/[0.04] px-4 py-3">
          <div className="truncate text-sm font-semibold text-black">{profile.full_name ?? "User"}</div>
          <div className="mt-0.5 truncate text-xs text-black/60">{profile.email ?? ""}</div>
          <div className="mt-2 inline-flex rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-semibold text-black">
            {profile.role.replaceAll("_", " ")}
          </div>
        </div>
      </div>
    </aside>
  );
}


"use client";

import Link from "next/link";
import { LayoutDashboard, Layers, Users } from "lucide-react";
import { NotificationsBell } from "@/components/NotificationsBell";

export function NavSidebarFixed() {
  return (
    <nav className="wm-card p-4">
      <div className="text-sm font-semibold text-black">Menu</div>
      <div className="mt-3 flex flex-col gap-2">
        <div className="[&_.wm-btn]:w-full [&_.wm-btn]:justify-start [&_.wm-btn]:text-black">
          <NotificationsBell />
        </div>
        <Link href="/dashboard" className="wm-btn h-10 justify-start rounded-2xl px-3 text-black">
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <Link href="/team" className="wm-btn h-10 justify-start rounded-2xl px-3 text-black">
          <Users className="h-4 w-4" />
          Team
        </Link>
        <Link href="/workspace" className="wm-btn h-10 justify-start rounded-2xl px-3 text-black">
          <Layers className="h-4 w-4" />
          Workspace
        </Link>
      </div>
    </nav>
  );
}


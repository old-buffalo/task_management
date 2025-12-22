"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import { AppShell } from "@/components/AppShell";

type Status = "pending" | "in_progress" | "review" | "completed" | "cancelled";

type DashboardStats = {
  total: number;
  assignedToMe: number;
  createdByMe: number;
  overdue: number;
  dueSoon: number;
  byStatus: Record<Status, number>;
  commentsCount: number;
  attachmentsCount: number;
};

type SessionState =
  | { state: "loading" }
  | { state: "anon" }
  | { state: "authed"; profile: Profile };

export default function DashboardPage() {
  const [session, setSession] = useState<SessionState>({ state: "loading" });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tasksBase = useMemo(() => "/tasks", []);

  function tasksHref(params: Record<string, string | number | undefined | null>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      qs.set(k, String(v));
    }
    const s = qs.toString();
    return s ? `${tasksBase}?${s}` : tasksBase;
  }

  async function loadMe() {
    const res = await fetch("/api/auth", { method: "GET" });
    if (res.status === 401) {
      setSession({ state: "anon" });
      return;
    }
    const json = (await res.json()) as { profile: Profile };
    setSession({ state: "authed", profile: json.profile });
  }

  async function loadDashboard() {
    setError(null);
    const res = await fetch("/api/dashboard", { method: "GET" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(j?.error ?? "Không tải được dashboard.");
    }
    const json = (await res.json()) as { stats: DashboardStats };
    setStats(json.stats);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadMe();
      } catch {
        setSession({ state: "anon" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session.state !== "authed") return;
    void loadDashboard().catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state]);

  if (session.state === "loading") {
    return (
      <div className="wm-bg flex min-h-dvh items-center justify-center">
        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Đang tải...
        </div>
      </div>
    );
  }

  if (session.state === "anon") {
    return (
      <div className="wm-bg flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Bạn cần đăng nhập để xem dashboard cá nhân.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Đi tới trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell profile={session.profile}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight text-black">Dashboard cá nhân</div>
          <div className="truncate text-xs text-black/60">
            {session.profile.full_name ?? "User"} • {session.profile.role.replaceAll("_", " ")}
          </div>
        </div>
        <Link href="/" className="wm-btn h-9 rounded-xl px-3 text-black">
          Về danh sách task
        </Link>
      </div>

      <div className="mt-4">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={tasksHref({ scope: "all" })}
            className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
          >
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Tổng công việc (trong phạm vi bạn thấy)</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{stats?.total ?? "—"}</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Được giao cho tôi:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-50">{stats?.assignedToMe ?? "—"}</span>
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Tôi tạo: <span className="font-medium text-zinc-900 dark:text-zinc-50">{stats?.createdByMe ?? "—"}</span>
            </div>
          </Link>

          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Deadline</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Link
                href={tasksHref({ overdue: 1 })}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <div className="text-xs text-zinc-600 dark:text-zinc-300">Quá hạn</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">{stats?.overdue ?? "—"}</div>
              </Link>
              <Link
                href={tasksHref({ dueSoonDays: 7 })}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <div className="text-xs text-zinc-600 dark:text-zinc-300">7 ngày tới</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">{stats?.dueSoon ?? "—"}</div>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-semibold tracking-tight">Theo trạng thái</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ["pending", "Pending"],
                ["in_progress", "Đang làm"],
                ["review", "Xem"],
                ["completed", "Hoàn thành"],
                ["cancelled", "Cancelled"],
              ] as const
            ).map(([k, label]) => (
              <Link
                key={k}
                href={tasksHref({ status: k })}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <div className="text-xs text-zinc-600 dark:text-zinc-300">{label}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">{stats?.byStatus?.[k] ?? "—"}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            href={tasksHref({ has: "comments" })}
            className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
          >
            <div className="text-sm font-semibold tracking-tight">Bình luận</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{stats?.commentsCount ?? "—"}</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Tổng số comment trong phạm vi task bạn thấy.</div>
          </Link>
          <Link
            href={tasksHref({ has: "attachments" })}
            className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
          >
            <div className="text-sm font-semibold tracking-tight">File đính kèm</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{stats?.attachmentsCount ?? "—"}</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Tổng số file đính kèm trong phạm vi task bạn thấy.</div>
          </Link>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            href={tasksHref({ scope: "assigned" })}
            className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
          >
            <div className="text-sm font-semibold tracking-tight">Được giao cho tôi</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{stats?.assignedToMe ?? "—"}</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Click để xem danh sách task được giao.</div>
          </Link>
          <Link
            href={tasksHref({ scope: "created" })}
            className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
          >
            <div className="text-sm font-semibold tracking-tight">Tôi tạo</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{stats?.createdByMe ?? "—"}</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Click để xem danh sách task bạn đã tạo.</div>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}



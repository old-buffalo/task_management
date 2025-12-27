"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import type { Profile, Task, TaskStatus } from "@/lib/types";

type SessionState =
  | { state: "loading" }
  | { state: "anon" }
  | { state: "authed"; profile: Profile };

export default function Home() {
  const [session, setSession] = useState<SessionState>({ state: "loading" });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const loadMe = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/auth", { method: "GET" });
      if (res.status === 401) {
        setSession({ state: "anon" });
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tải được phiên đăng nhập.");
      }
      const json = (await res.json()) as { profile?: Profile };
      if (!json.profile) throw new Error("Dữ liệu phiên đăng nhập không hợp lệ.");
      setSession({ state: "authed", profile: json.profile });
    } catch (e) {
      setSession({ state: "anon" });
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    }
  }, []);

  const loadTasks = useCallback(async (nextStatus: TaskStatus | "all" = statusFilter) => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (nextStatus !== "all") qs.set("status", nextStatus);
      const res = await fetch(`/api/tasks?${qs.toString()}`, { method: "GET" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tải được danh sách công việc.");
      }
      const json = (await res.json()) as { tasks: Task[] };
      setTasks(json.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void (async () => {
      await loadMe();
    })();
  }, [loadMe]);

  useEffect(() => {
    if (session.state === "authed") {
      void loadTasks("all");
    }
  }, [session.state, loadTasks]);

  useEffect(() => {
    if (session.state !== "authed") return;
    void loadTasks(statusFilter);
  }, [session.state, loadTasks, statusFilter]);

  if (session.state === "loading") {
    return <LoadingScreen />;
  }

  if (session.state === "anon") {
    return (
      <div className="wm-bg flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md wm-card p-6 text-black">
          <h1 className="text-xl font-semibold tracking-tight text-black">Work Management</h1>
          <p className="mt-2 text-sm text-black/70">
            Bạn cần đăng nhập để xem và quản lý công việc.
          </p>
          {error ? (
            <div className="mt-4 wm-danger">
              {error}
            </div>
          ) : null}
          <Link
            href="/login"
            className="mt-5 w-full wm-btn-primary"
          >
            Đi tới trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell profile={session.profile}>
      <div className="min-h-dvh space-y-4">
        <div className="wm-card p-4">
          <TaskForm
            onCreated={() => {
              void loadTasks(statusFilter);
            }}
          />
        </div>

        <div className="mt-4 wm-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-black">Danh sách công việc</h2>
            <select
              value={statusFilter}
              onChange={(e) => {
                const next = e.target.value as TaskStatus | "all";
                setStatusFilter(next);
                void loadTasks(next);
              }}
              className="h-9 rounded-xl border border-black/10 bg-white/70 px-3 text-sm text-black outline-none hover:bg-white"
            >
              <option value="all">Tất cả</option>
              <option value="pending">Pending</option>
              <option value="in_progress">Đang làm</option>
              <option value="review">Xem</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {error ? (
            <div className="mt-3 wm-danger">
              {error}
            </div>
          ) : null}

          <div className="mt-3">
            <TaskList
              tasks={filtered}
              busy={busy}
              onChanged={() => void loadTasks(statusFilter)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

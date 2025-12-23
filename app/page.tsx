"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const loadTasks = useCallback(async (nextStatus: TaskStatus | "all" = statusFilter, qText = debouncedSearch) => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (nextStatus !== "all") qs.set("status", nextStatus);
      const q = qText.trim();
      if (q) qs.set("q", q);
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
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 250);
    return () => clearTimeout(t);
  }, [searchText]);

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
    void loadTasks(statusFilter, debouncedSearch);
  }, [debouncedSearch, session.state, loadTasks, statusFilter]);

  if (session.state === "loading") {
    return (
      <div className="wm-bg flex min-h-dvh items-center justify-center">
        <div className="wm-card-2 px-5 py-4 text-sm text-[rgba(232,235,245,0.72)]">
          Đang tải...
        </div>
      </div>
    );
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
      <div className="space-y-4">
        <div className="sticky top-16 z-10">
          <div className="wm-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-black">Work Management</h1>
                <div className="mt-1 text-xs text-black/70">
                  Tìm nhanh công việc theo tiêu đề / mô tả
                </div>
              </div>
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search…"
                  className="wm-input pl-10 pr-10"
                />
                {searchText ? (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl hover:bg-black/5"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4 text-black/60" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="wm-card p-4">
          <TaskForm
            onCreated={() => {
              void loadTasks(statusFilter, debouncedSearch);
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
                void loadTasks(next, debouncedSearch);
              }}
              className="h-9 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white outline-none hover:bg-white/[0.08]"
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
              onChanged={() => void loadTasks(statusFilter, debouncedSearch)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

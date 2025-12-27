"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TaskList } from "@/components/TaskList";
import type { Profile, Task, TaskStatus } from "@/lib/types";

type SessionState =
  | { state: "loading" }
  | { state: "anon" }
  | { state: "authed"; profile: Profile };

function isTaskStatus(s: string | null): s is TaskStatus {
  return (
    s === "pending" ||
    s === "in_progress" ||
    s === "review" ||
    s === "completed" ||
    s === "cancelled"
  );
}

export function TasksClient() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionState>({ state: "loading" });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const status = searchParams.get("status");
  const scope = searchParams.get("scope"); // assigned | created | all
  const overdue = searchParams.get("overdue") === "1";
  const dueSoonDays = Number.parseInt(searchParams.get("dueSoonDays") || "", 10);
  const has = searchParams.get("has"); // comments,attachments
  const qFromUrl = searchParams.get("q") || "";

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

  const loadTasks = useCallback(
    async (profile: Profile) => {
      setBusy(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (isTaskStatus(status)) qs.set("status", status);
        if (scope === "assigned") qs.set("assignedTo", profile.id);
        if (scope === "created") qs.set("createdBy", profile.id);
        if (has) qs.set("has", has);
        const q = debouncedSearch.trim() || qFromUrl.trim();
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
    },
    [debouncedSearch, has, qFromUrl, scope, status],
  );

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    setSearchText(qFromUrl);
    setDebouncedSearch(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 250);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    if (session.state !== "authed") return;
    void loadTasks(session.profile);
  }, [debouncedSearch, session.state, loadTasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    const now = new Date();
    if (overdue) {
      list = list.filter((t) => {
        if (!t.due_date) return false;
        if (t.status === "completed" || t.status === "cancelled") return false;
        return new Date(t.due_date).getTime() < now.getTime();
      });
    }
    if (Number.isFinite(dueSoonDays) && dueSoonDays > 0) {
      const soon = new Date(now);
      soon.setDate(soon.getDate() + dueSoonDays);
      list = list.filter((t) => {
        if (!t.due_date) return false;
        if (t.status === "completed" || t.status === "cancelled") return false;
        const d = new Date(t.due_date).getTime();
        return d >= now.getTime() && d <= soon.getTime();
      });
    }
    return list;
  }, [dueSoonDays, overdue, tasks]);

  if (session.state === "loading") {
    return <LoadingScreen />;
  }

  if (session.state === "anon") {
    return (
      <div className="wm-bg flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold tracking-tight">Danh sách task</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Bạn cần đăng nhập để xem dữ liệu.
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
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">Kết quả lọc</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              status={status || "all"} • scope={scope || "all"}
              {overdue ? " • overdue" : ""}
              {Number.isFinite(dueSoonDays) && dueSoonDays > 0 ? ` • dueSoonDays=${dueSoonDays}` : ""}
              {has ? ` • has=${has}` : ""}
              {(debouncedSearch || qFromUrl) ? ` • q=${debouncedSearch || qFromUrl}` : ""}
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Quay lại Dashboard
          </Link>
        </div>

        <div className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search…"
              className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-10 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700"
            />
            {searchText ? (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-zinc-500" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4">
        <TaskList tasks={filtered} busy={busy} onChanged={() => void loadTasks(session.profile)} />
      </div>
    </AppShell>
  );
}



"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TeamPanel } from "@/components/TeamPanel";
import { TaskList } from "@/components/TaskList";
import type { Profile, Task, Team } from "@/lib/types";

type SessionState =
  | { state: "loading" }
  | { state: "anon" }
  | { state: "authed"; profile: Profile };

export default function TeamPage() {
  const [session, setSession] = useState<SessionState>({ state: "loading" });
  const [team, setTeam] = useState<Team | null>(null);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadTeam = useCallback(async () => {
    const res = await fetch("/api/teams/me", { method: "GET" });
    if (!res.ok) {
      setTeam(null);
      return null;
    }
    const json = (await res.json()) as { team: Team | null };
    const next = json.team ?? null;
    setTeam(next);
    return next;
  }, []);

  const loadTeamTasks = useCallback(async (teamId: string) => {
    setTeamBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("teamId", teamId);
      qs.set("status", "in_progress");
      const res = await fetch(`/api/tasks?${qs.toString()}`, { method: "GET" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tải được công việc nhóm.");
      }
      const json = (await res.json()) as { tasks: Task[] };
      setTeamTasks(json.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setTeamBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (session.state !== "authed") return;
    void loadTeam();
  }, [session.state, loadTeam]);

  useEffect(() => {
    if (!team?.id) return;
    void loadTeamTasks(team.id);
  }, [team?.id, loadTeamTasks]);

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
          <h1 className="text-xl font-semibold tracking-tight">Team</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Bạn cần đăng nhập để vào khu vực làm việc nhóm.
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
      <div className="space-y-4">
        <TeamPanel
          onChanged={() => {
            void loadTeam().then((t) => {
              if (t?.id) void loadTeamTasks(t.id);
            });
          }}
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {team?.id ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight">Công việc nhóm đang thực hiện</h2>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">{team.name}</div>
            </div>
            <div className="mt-3">
              <TaskList tasks={teamTasks} busy={teamBusy} onChanged={() => void loadTeamTasks(team.id)} />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Bạn chưa thuộc nhóm nào. Hãy tạo nhóm hoặc join bằng mã nhóm.
          </div>
        )}
      </div>
    </AppShell>
  );
}



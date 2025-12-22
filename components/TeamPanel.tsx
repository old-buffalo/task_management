"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import type { Team } from "@/lib/types";

export function TeamPanel({ onChanged }: { onChanged: () => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/teams/me", { method: "GET" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tải được thông tin nhóm.");
      }
      const json = (await res.json()) as { team: Team | null };
      setTeam(json.team);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTeam() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tạo được nhóm.");
      }
      const json = (await res.json()) as { team: Team };
      setTeam(json.team);
      setName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  async function joinTeam() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tham gia được nhóm.");
      }
      const json = (await res.json()) as { team: Team };
      setTeam(json.team);
      setCode("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <div className="text-sm font-semibold tracking-tight">Nhóm</div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Reload
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Đang tải…</div>
      ) : team ? (
        <div className="mt-3">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{team.name}</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Mã tham gia: <span className="font-mono font-semibold">{team.join_code ?? "—"}</span>
          </div>
          {!team.join_code ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              Chưa có <span className="font-mono">teams.join_code</span> trong DB. Hãy chạy migration/schema mới rồi reload.
            </div>
          ) : null}
          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            Chia sẻ mã này cho thành viên khác để họ join nhóm.
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Tạo nhóm mới</div>
            <div className="mt-2 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên nhóm…"
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => void createTeam()}
                disabled={busy || name.trim().length < 2}
                className="h-11 shrink-0 rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Tạo
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Tham gia nhóm</div>
            <div className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Nhập mã nhóm…"
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => void joinTeam()}
                disabled={busy || code.trim().length < 8}
                className="h-11 shrink-0 rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



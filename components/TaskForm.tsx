"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { PriorityLevel } from "@/lib/types";

export function TaskForm({
  onCreated,
  workspaceId,
}: {
  onCreated: () => void;
  workspaceId?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          priority,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          workspace_id: workspaceId ?? null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tạo được công việc.");
      }
      setTitle("");
      setDueDate("");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Tạo công việc</h2>
        <div className="text-xs text-zinc-600 dark:text-zinc-300">Mobile-first • nhanh gọn</div>
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề công việc…"
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700"
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as PriorityLevel)}
            className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy || title.trim().length < 3}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          {busy ? "Đang tạo..." : "Tạo công việc"}
        </button>
      </div>
    </div>
  );
}



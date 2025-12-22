"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole, Workspace, WorkspaceMember } from "@/lib/types";
import type { Task, TaskStatus } from "@/lib/types";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";

const ROLE_LABEL: Record<UserRole, string> = {
  truong_phong: "Trưởng phòng",
  pho_phong: "Phó phòng",
  doi_truong: "Đội trưởng",
  doi_pho: "Đội phó",
  can_bo: "Cán bộ",
};

const ROLE_ORDER: UserRole[] = ["truong_phong", "pho_phong", "doi_truong", "doi_pho", "can_bo"];

export function WorkspacePanel() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [tasksBusy, setTasksBusy] = useState(false);

  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("can_bo");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? null,
    [workspaces, activeId],
  );

  const loadWorkspaces = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/workspaces", { method: "GET" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(j?.error ?? "Không tải được workspace.");
    }
    const json = (await res.json()) as { workspaces: Workspace[] };
    const list = json.workspaces ?? [];
    setWorkspaces(list);
    if (!activeId && list.length) setActiveId(list[0]!.id);
  }, [activeId]);

  const loadMembers = useCallback(async (workspaceId: string) => {
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, { method: "GET" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(j?.error ?? "Không tải được thành viên workspace.");
    }
    const json = (await res.json()) as { members: WorkspaceMember[] };
    setMembers(json.members ?? []);
  }, []);

  const loadWorkspaceTasks = useCallback(
    async (workspaceId: string, nextStatus: TaskStatus | "all" = statusFilter) => {
      setError(null);
      setTasksBusy(true);
      try {
        const qs = new URLSearchParams();
        qs.set("workspaceId", workspaceId);
        if (nextStatus !== "all") qs.set("status", nextStatus);
        const res = await fetch(`/api/tasks?${qs.toString()}`, { method: "GET" });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? "Không tải được task của workspace.");
        }
        const json = (await res.json()) as { tasks: Task[] };
        setTasks(json.tasks ?? []);
      } finally {
        setTasksBusy(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void loadWorkspaces().catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra."));
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!activeId) return;
    void loadMembers(activeId).catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra."));
    void loadWorkspaceTasks(activeId).catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra."));
  }, [activeId, loadMembers]);

  async function createWorkspace() {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tạo được workspace.");
      }
      setName("");
      await loadWorkspaces();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  async function addMember() {
    if (!activeId) return;
    const email = inviteEmail.trim();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${activeId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không thêm được thành viên.");
      }
      setInviteEmail("");
      await loadMembers(activeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wm-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-black">Workspace</h2>
          <div className="mt-1 text-xs text-black/70">
            Tạo workspace và thêm user theo cấp bậc (trưởng phòng → cán bộ).
          </div>
        </div>
        {workspaces.length ? (
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
            className="h-9 rounded-xl border border-black/10 bg-white/70 px-3 text-sm text-black outline-none hover:bg-white"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? <div className="mt-3 wm-danger">{error}</div> : null}

      {!workspaces.length ? (
        <div className="mt-4 grid gap-3">
          <div className="text-sm text-black/70">Bạn chưa có workspace nào. Hãy tạo mới:</div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên workspace…"
              className="wm-input"
            />
            <button
              type="button"
              onClick={createWorkspace}
              disabled={busy || name.trim().length < 2}
              className="wm-btn-primary h-11 rounded-2xl px-4"
            >
              Tạo
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="wm-card-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-black">Task trong workspace</div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  const next = e.target.value as TaskStatus | "all";
                  setStatusFilter(next);
                  if (activeId) void loadWorkspaceTasks(activeId, next);
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

            <div className="mt-3 wm-card-2 p-4">
              <TaskForm
                workspaceId={activeId}
                onCreated={() => {
                  if (activeId) void loadWorkspaceTasks(activeId, statusFilter);
                }}
              />
            </div>

            <div className="mt-3">
              <TaskList
                tasks={tasks}
                busy={tasksBusy}
                onChanged={() => {
                  if (activeId) void loadWorkspaceTasks(activeId, statusFilter);
                }}
              />
            </div>
          </div>

          <div className="wm-card-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-black">{active?.name ?? "Workspace"}</div>
              <div className="text-xs text-black/70">
                Quyền của bạn: <span className="font-semibold">{active?.my_role ? ROLE_LABEL[active.my_role] : "N/A"}</span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email user…"
                className="wm-input sm:col-span-2"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="h-11 rounded-2xl border border-black/10 bg-white/70 px-3 text-sm text-black outline-none hover:bg-white"
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={addMember}
              disabled={busy || !activeId || inviteEmail.trim().length === 0}
              className="mt-3 wm-btn h-11 w-full rounded-2xl px-4 text-black"
            >
              Thêm thành viên
            </button>
            <div className="mt-2 text-xs text-black/60">
              Lưu ý: user cần đăng nhập ít nhất 1 lần để có profile trong DB (mới add theo email được).
            </div>
          </div>

          <div className="wm-card-2 p-4">
            <div className="text-sm font-semibold text-black">Thành viên ({members.length})</div>
            <div className="mt-3 space-y-2">
              {members.length ? (
                members.map((m) => (
                  <div
                    key={`${m.workspace_id}-${m.user_id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-black">
                        {m.user?.full_name ?? m.user?.email ?? m.user_id}
                      </div>
                      <div className="truncate text-xs text-black/60">{m.user?.email ?? ""}</div>
                    </div>
                    <div className="shrink-0 rounded-full border border-black/10 bg-white/70 px-2 py-1 text-xs font-semibold text-black">
                      {ROLE_LABEL[m.role]}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-black/70">Chưa có thành viên.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



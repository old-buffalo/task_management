"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock3, FileUp, MessageSquareText, Paperclip, Send, Trash2, XCircle } from "lucide-react";
import type { Task, TaskAttachment, TaskComment, TaskStatus } from "@/lib/types";

function formatDateTimeVi(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(s: TaskStatus) {
  switch (s) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "Đang làm";
    case "review":
      return "Xem";
    case "completed":
      return "Hoàn thành";
    case "cancelled":
      return "Cancelled";
  }
}

function StatusIcon({ status }: { status: TaskStatus }) {
  const cls = "h-4 w-4";
  if (status === "completed") return <CheckCircle2 className={`${cls} text-emerald-700`} />;
  if (status === "cancelled") return <XCircle className={`${cls} text-red-700`} />;
  if (status === "in_progress") return <Clock3 className={`${cls} text-blue-700`} />;
  if (status === "review") return <Circle className={`${cls} text-amber-700`} />;
  return <Circle className={`${cls} text-zinc-400`} />;
}

function statusCardClass(status: TaskStatus) {
  // Light theme: bolder tint + border per status
  switch (status) {
    case "in_progress":
      return "border-blue-300 bg-blue-100/80";
    case "review":
      return "border-amber-300 bg-amber-100/80";
    case "completed":
      return "border-emerald-300 bg-emerald-100/80";
    case "cancelled":
      return "border-red-300 bg-red-100/80";
    default:
      return "border-black/10 bg-white/80";
  }
}

function statusBadgeClass(status: TaskStatus) {
  switch (status) {
    case "in_progress":
      return "border-blue-300 bg-blue-200/70 text-blue-950";
    case "review":
      return "border-amber-300 bg-amber-200/70 text-amber-950";
    case "completed":
      return "border-emerald-300 bg-emerald-200/70 text-emerald-950";
    case "cancelled":
      return "border-red-300 bg-red-200/70 text-red-950";
    default:
      return "border-black/10 bg-black/[0.04] text-black/80";
  }
}

function priorityBadgeClass(priority: Task["priority"]) {
  switch (priority) {
    case "low":
      return "border-sky-300 bg-sky-200/70 text-sky-950";
    case "medium":
      return "border-indigo-300 bg-indigo-200/70 text-indigo-950";
    case "high":
      return "border-orange-300 bg-orange-200/70 text-orange-950";
    case "urgent":
      return "border-rose-300 bg-rose-200/70 text-rose-950";
  }
}

export function TaskList({
  tasks,
  busy,
  onChanged,
}: {
  tasks: Task[];
  busy: boolean;
  onChanged: () => void;
}) {
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachmentsByTask, setAttachmentsByTask] = useState<Record<string, (TaskAttachment & { url?: string | null })[]>>({});
  const [openAttachments, setOpenAttachments] = useState<Record<string, boolean>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [commentsByTask, setCommentsByTask] = useState<Record<string, TaskComment[]>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [draftByTask, setDraftByTask] = useState<Record<string, string>>({});
  const [postingCommentId, setPostingCommentId] = useState<string | null>(null);

  async function updateStatus(id: string, status: TaskStatus) {
    setError(null);
    setWorkingId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không cập nhật được trạng thái.");
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("Xóa công việc này?")) return;
    setError(null);
    setWorkingId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không xóa được công việc.");
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setWorkingId(null);
    }
  }

  async function loadAttachments(taskId: string) {
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "GET" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(j?.error ?? "Không tải được danh sách file.");
    }
    const json = (await res.json()) as {
      attachments: (TaskAttachment & { url?: string | null })[];
    };
    setAttachmentsByTask((prev) => ({ ...prev, [taskId]: json.attachments ?? [] }));
  }

  async function uploadAttachment(taskId: string, file: File) {
    setError(null);
    setUploadingId(taskId);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không upload được file.");
      }
      await loadAttachments(taskId);
      setOpenAttachments((prev) => ({ ...prev, [taskId]: true }));
    } finally {
      setUploadingId(null);
    }
  }

  async function loadComments(taskId: string) {
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/comments`, { method: "GET" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(j?.error ?? "Không tải được bình luận.");
    }
    const json = (await res.json()) as { comments: TaskComment[] };
    setCommentsByTask((prev) => ({ ...prev, [taskId]: json.comments ?? [] }));
  }

  async function postComment(taskId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;
    setError(null);
    setPostingCommentId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không gửi được bình luận.");
      }
      setDraftByTask((prev) => ({ ...prev, [taskId]: "" }));
      await loadComments(taskId);
      setOpenComments((prev) => ({ ...prev, [taskId]: true }));
    } finally {
      setPostingCommentId(null);
    }
  }

  if (busy) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        Đang tải danh sách...
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        Chưa có công việc nào.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {tasks.map((t) => {
        const isWorking = workingId === t.id;
        const isUploading = uploadingId === t.id;
        const isOpen = !!openAttachments[t.id];
        const attachments = attachmentsByTask[t.id] ?? [];
        const isCommentsOpen = !!openComments[t.id];
        const comments = commentsByTask[t.id] ?? [];
        const sortedComments = [...comments].sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return ta - tb; // old -> new
        });
        const draft = draftByTask[t.id] ?? "";
        const isPosting = postingCommentId === t.id;
        const cardTone = statusCardClass(t.status);
        return (
          <div
            key={t.id}
            className={`rounded-3xl border p-4 shadow-sm ${cardTone}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusIcon status={t.status} />
                  <div className="truncate text-sm font-semibold">{t.title}</div>
                </div>
                {t.description ? (
                  <div className="mt-1 whitespace-pre-wrap text-sm text-black/85">
                    {t.description}
                  </div>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-1 font-semibold ${statusBadgeClass(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                  <span className={`rounded-full border px-2 py-1 font-semibold uppercase ${priorityBadgeClass(t.priority)}`}>
                    {t.priority}
                  </span>
                  {t.due_date ? (
                    <span className="rounded-full border border-black/10 bg-black/[0.04] px-2 py-1 text-black/80">
                      Due: {new Date(t.due_date).toLocaleDateString("vi-VN")}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void deleteTask(t.id)}
                disabled={isWorking}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void updateStatus(t.id, "in_progress")}
                disabled={isWorking}
                className="h-9 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                Đang làm
              </button>
              <button
                type="button"
                onClick={() => void updateStatus(t.id, "review")}
                disabled={isWorking}
                className="h-9 rounded-xl bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
              >
                Xem
              </button>
              <button
                type="button"
                onClick={() => void updateStatus(t.id, "completed")}
                disabled={isWorking}
                className="h-9 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                Hoàn thành
              </button>
              <button
                type="button"
                onClick={() => void updateStatus(t.id, "cancelled")}
                disabled={isWorking}
                className="h-9 rounded-xl bg-zinc-200 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isOpen;
                    setOpenAttachments((prev) => ({ ...prev, [t.id]: next }));
                    if (next && !attachmentsByTask[t.id]) {
                      void loadAttachments(t.id).catch((e) => {
                        setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
                      });
                    }
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
                >
                  <Paperclip className="h-4 w-4" />
                  File đính kèm {attachmentsByTask[t.id] ? `(${attachments.length})` : ""}
                </button>

                <div className="flex items-center gap-2">
                  <input
                    id={`file-${t.id}`}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (!f) return;
                      void uploadAttachment(t.id, f).catch((err) => {
                        setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
                      });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`file-${t.id}`) as HTMLInputElement | null;
                      el?.click();
                    }}
                    disabled={isUploading}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    <FileUp className="h-4 w-4" />
                    {isUploading ? "Đang upload..." : "Upload"}
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="mt-3 space-y-2">
                  {attachmentsByTask[t.id] ? (
                    attachments.length ? (
                      attachments.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{a.file_name ?? a.storage_path}</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-300">
                              {a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : ""}
                            </div>
                          </div>
                          {a.url ? (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
                            >
                              Tải xuống
                            </a>
                          ) : (
                            <span className="shrink-0 text-xs text-zinc-500">N/A</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-zinc-600 dark:text-zinc-300">Chưa có file.</div>
                    )
                  ) : (
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">Đang tải…</div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isCommentsOpen;
                    setOpenComments((prev) => ({ ...prev, [t.id]: next }));
                    if (next && !commentsByTask[t.id]) {
                      void loadComments(t.id).catch((e) => {
                        setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
                      });
                    }
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
                >
                  <MessageSquareText className="h-4 w-4" />
                  Bình luận {commentsByTask[t.id] ? `(${comments.length})` : ""}
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraftByTask((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  rows={2}
                  placeholder="Viết bình luận…"
                  className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => void postComment(t.id, draft).catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra."))}
                  disabled={isPosting || draft.trim().length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  <Send className="h-4 w-4" />
                  {isPosting ? "Đang gửi..." : "Gửi bình luận"}
                </button>
              </div>

              {isCommentsOpen ? (
                <div className="mt-3 space-y-2">
                  {commentsByTask[t.id] ? (
                    sortedComments.length ? (
                      sortedComments.map((c, idx) => (
                        <div
                          key={c.id}
                          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                              #{idx + 1} • {(c.author?.full_name ?? c.author?.email ?? "User").toString()}
                            </div>
                            <div className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                              {formatDateTimeVi(c.created_at)}
                            </div>
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-50">
                            {c.content}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-zinc-600 dark:text-zinc-300">Chưa có bình luận.</div>
                    )
                  ) : (
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">Đang tải…</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}



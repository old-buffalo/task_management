"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Clock3, FileUp, MessageSquareText, Paperclip, Plus, Send, Trash2, XCircle } from "lucide-react";
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
  // Light theme: background matches status tone (same palette as badges)
  switch (status) {
    case "in_progress":
      return "border-blue-300/80 ring-1 ring-blue-300/30 bg-blue-200/55";
    case "review":
      return "border-amber-300/80 ring-1 ring-amber-300/30 bg-amber-200/55";
    case "completed":
      return "border-emerald-300/80 ring-1 ring-emerald-300/30 bg-emerald-200/55";
    case "cancelled":
      return "border-red-300/80 ring-1 ring-red-300/30 bg-red-200/55";
    default:
      return "border-black/10 ring-1 ring-black/5 bg-white/75";
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
  const sortedTasks = [...tasks].sort((a, b) => {
    const ta = a.created_at || a.updated_at || "";
    const tb = b.created_at || b.updated_at || "";
    const da = ta ? new Date(ta).getTime() : 0;
    const db = tb ? new Date(tb).getTime() : 0;
    return db - da; // newest first
  });

  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachmentsByTask, setAttachmentsByTask] = useState<Record<string, (TaskAttachment & { url?: string | null })[]>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [commentsByTask, setCommentsByTask] = useState<Record<string, TaskComment[]>>({});
  const [draftByTask, setDraftByTask] = useState<Record<string, string>>({});
  const [postingCommentId, setPostingCommentId] = useState<string | null>(null);
  const [commentFileByTask, setCommentFileByTask] = useState<Record<string, File | null>>({});
  const [actionMenuOpen, setActionMenuOpen] = useState<Record<string, boolean>>({});
  const [openAttachmentsPanel, setOpenAttachmentsPanel] = useState<Record<string, boolean>>({});
  const loadingCommentsRef = useRef<Record<string, boolean>>({});
  const loadingAttachmentsRef = useRef<Record<string, boolean>>({});
  const commentsLoadedRef = useRef<Record<string, boolean>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

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
    if (loadingAttachmentsRef.current[taskId]) return;
    loadingAttachmentsRef.current[taskId] = true;
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "GET" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tải được danh sách file.");
      }
      const json = (await res.json()) as {
        attachments: (TaskAttachment & { url?: string | null })[];
      };
      setAttachmentsByTask((prev) => ({ ...prev, [taskId]: json.attachments ?? [] }));
    } finally {
      loadingAttachmentsRef.current[taskId] = false;
    }
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
      setOpenAttachmentsPanel((prev) => ({ ...prev, [taskId]: true }));
    } finally {
      setUploadingId(null);
    }
  }

  async function loadComments(taskId: string) {
    if (loadingCommentsRef.current[taskId]) return;
    loadingCommentsRef.current[taskId] = true;
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, { method: "GET" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tải được bình luận.");
      }
      const json = (await res.json()) as { comments: TaskComment[] };
      setCommentsByTask((prev) => ({ ...prev, [taskId]: json.comments ?? [] }));
      commentsLoadedRef.current[taskId] = true;
    } finally {
      loadingCommentsRef.current[taskId] = false;
    }
  }

  async function postComment(taskId: string, content: string) {
    const trimmed = content.trim();
    const file = commentFileByTask[taskId] ?? null;
    if (!trimmed && !file) return;
    setError(null);
    setPostingCommentId(taskId);
    try {
      let attachmentId: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        const up = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: fd });
        if (!up.ok) {
          const j = (await up.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? "Không upload được file.");
        }
        const uj = (await up.json()) as { attachment?: { id: string } };
        attachmentId = uj.attachment?.id;
        setOpenAttachmentsPanel((prev) => ({ ...prev, [taskId]: true }));
      }

      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed || "(đính kèm file)", attachmentId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không gửi được bình luận.");
      }
      setDraftByTask((prev) => ({ ...prev, [taskId]: "" }));
      setCommentFileByTask((prev) => ({ ...prev, [taskId]: null }));
      await loadComments(taskId);
    } finally {
      setPostingCommentId(null);
    }
  }

  // Auto-load comments lazily when each card enters viewport (better performance).
  useEffect(() => {
    if (typeof window === "undefined") return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const taskId = el.dataset.taskId || "";
          if (!taskId) continue;

          // Load once per task when visible.
          if (!commentsLoadedRef.current[taskId] && commentsByTask[taskId] === undefined) {
            void loadComments(taskId).catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra."));
          }
          observerRef.current?.unobserve(el);
        }
      },
      { root: null, threshold: 0.15 },
    );

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsByTask]);

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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {error ? (
        <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {sortedTasks.map((t) => {
        const isWorking = workingId === t.id;
        const isUploading = uploadingId === t.id;
        const attachments = attachmentsByTask[t.id] ?? [];
        const comments = commentsByTask[t.id] ?? [];
        const sortedComments = [...comments].sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return ta - tb; // old -> new
        });
        const draft = draftByTask[t.id] ?? "";
        const isPosting = postingCommentId === t.id;
        const cardTone = statusCardClass(t.status);
        const attachmentCountText = attachmentsByTask[t.id] ? `(${attachments.length})` : "";
        const commentCountText = commentsByTask[t.id] ? `(${comments.length})` : "";
        const isMenuOpen = !!actionMenuOpen[t.id];
        const showAttachments = !!openAttachmentsPanel[t.id];
        const commentFile = commentFileByTask[t.id] ?? null;
        return (
          <div
            key={t.id}
            data-task-id={t.id}
            ref={(el) => {
              if (!el) return;
              // Observe card to lazy-load comments.
              observerRef.current?.observe(el);
            }}
            className={`wm-hover-lift flex h-full flex-col rounded-3xl border p-4 shadow-[var(--wm-shadow-md)] backdrop-blur-xl ${cardTone}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusIcon status={t.status} />
                  <div className="truncate text-sm font-semibold">{t.title}</div>
                </div>
                {t.description ? (
                  <div className="mt-1 whitespace-pre-wrap text-base font-semibold text-black/90">
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
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 text-sm font-semibold text-black hover:bg-white disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </button>
            </div>

            {/* Activity panel: attachments + comments in one box */}
            <div className="mt-3 rounded-3xl border border-black/10 bg-white/60 p-3 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-black">
                  Bình luận {commentCountText}
                </div>

                {/* One "Add" button with click options */}
                <div className="relative flex items-center gap-2">
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
                      setActionMenuOpen((prev) => ({ ...prev, [t.id]: !isMenuOpen }));
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-black px-3 text-xs font-semibold text-white hover:bg-black/90"
                    aria-label="Thêm"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Thêm</span>
                  </button>

                  {isMenuOpen ? (
                    <div className="absolute right-0 top-12 z-20 w-44 rounded-2xl border border-black/10 bg-white/90 p-1 shadow-[var(--wm-shadow-md)] backdrop-blur-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen((prev) => ({ ...prev, [t.id]: false }));
                          const el = document.getElementById(`comment-file-${t.id}`) as HTMLInputElement | null;
                          el?.click();
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-black hover:bg-black/[0.06]"
                      >
                        <Paperclip className="h-4 w-4" />
                        Đính kèm vào bình luận
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen((prev) => ({ ...prev, [t.id]: false }));
                          setOpenAttachmentsPanel((prev) => ({ ...prev, [t.id]: true }));
                          if (!attachmentsByTask[t.id]) {
                            void loadAttachments(t.id).catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra."));
                          }
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-black hover:bg-black/[0.06]"
                      >
                        <Paperclip className="h-4 w-4" />
                        Xem file
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen((prev) => ({ ...prev, [t.id]: false }));
                          setOpenAttachmentsPanel((prev) => ({ ...prev, [t.id]: true }));
                          const el = document.getElementById(`file-${t.id}`) as HTMLInputElement | null;
                          el?.click();
                        }}
                        disabled={isUploading}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-black hover:bg-black/[0.06] disabled:opacity-60"
                      >
                        <FileUp className="h-4 w-4" />
                        {isUploading ? "Upload..." : "Upload file"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-3">
                {showAttachments ? (
                  <div className="mb-3 space-y-2">
                    <div className="text-xs font-semibold text-black/70">
                      File đính kèm {attachmentCountText}
                    </div>
                    {attachmentsByTask[t.id] ? (
                      attachments.length ? (
                        attachments.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">{a.file_name ?? a.storage_path}</div>
                              <div className="text-xs text-black/60">
                                {a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : ""}
                              </div>
                            </div>
                            {a.url ? (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 rounded-xl bg-black/[0.06] px-2 py-1 text-xs font-semibold text-black hover:bg-black/[0.10]"
                              >
                                Tải xuống
                              </a>
                            ) : (
                              <span className="shrink-0 text-xs text-zinc-500">N/A</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-black/60">
                          Chưa có file.
                        </div>
                      )
                    ) : (
                      <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-black/60">
                        Đang tải…
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <input
                    id={`comment-file-${t.id}`}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.currentTarget.value = "";
                      setCommentFileByTask((prev) => ({ ...prev, [t.id]: f }));
                    }}
                  />

                  {commentFile ? (
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs text-black">
                      <div className="min-w-0 truncate">
                        <span className="font-semibold">File:</span> {commentFile.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCommentFileByTask((prev) => ({ ...prev, [t.id]: null }))}
                        className="shrink-0 rounded-xl bg-black/[0.06] px-2 py-1 text-xs font-semibold text-black hover:bg-black/[0.10]"
                      >
                        Bỏ
                      </button>
                    </div>
                  ) : null}

                  <textarea
                    value={draft}
                    onChange={(e) => setDraftByTask((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    rows={2}
                    placeholder="Viết bình luận…"
                    className="w-full resize-none rounded-3xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black outline-none placeholder:text-black/40 focus:border-black/15"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void postComment(t.id, draft).catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra."))
                    }
                    disabled={isPosting || (draft.trim().length === 0 && !commentFile)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-black px-4 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {isPosting ? "Đang gửi..." : "Gửi bình luận"}
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {commentsByTask[t.id] ? (
                    sortedComments.length ? (
                      sortedComments.map((c, idx) => (
                        <div
                          key={c.id}
                          className="rounded-3xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 truncate text-xs font-semibold text-black/70">
                              #{idx + 1} • {(c.author?.full_name ?? c.author?.email ?? "User").toString()}
                            </div>
                            <div className="shrink-0 text-[11px] text-black/50">{formatDateTimeVi(c.created_at)}</div>
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-black">{c.content}</div>
                          {c.attachment ? (
                            <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 px-3 py-2 text-xs">
                              <div className="min-w-0 truncate text-black/80">
                                <span className="font-semibold">File:</span>{" "}
                                {c.attachment.file_name ?? c.attachment.storage_path}
                              </div>
                              {c.attachment.url ? (
                                <a
                                  href={c.attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 rounded-xl bg-black/[0.06] px-2 py-1 text-xs font-semibold text-black hover:bg-black/[0.10]"
                                >
                                  Tải xuống
                                </a>
                              ) : (
                                <span className="shrink-0 text-black/50">N/A</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      null
                    )
                  ) : (
                    <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-black/60">
                      Đang tải…
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}



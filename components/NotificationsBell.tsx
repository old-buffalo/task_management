"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { Notification } from "@/lib/types";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const badge = useMemo(() => (unreadCount > 99 ? "99+" : String(unreadCount)), [unreadCount]);

  async function refresh({ forDropdown }: { forDropdown: boolean }) {
    setError(null);
    setBusy(forDropdown);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", forDropdown ? "10" : "1");
      const res = await fetch(`/api/notifications?${qs.toString()}`, { method: "GET" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tải được thông báo.");
      }
      const json = (await res.json()) as {
        notifications: Notification[];
        unreadCount: number;
      };
      setUnreadCount(json.unreadCount ?? 0);
      if (forDropdown) setItems(json.notifications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không cập nhật được.");
      }
      await refresh({ forDropdown: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh({ forDropdown: false });
    timerRef.current = window.setInterval(() => {
      void refresh({ forDropdown: false });
    }, 15000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh({ forDropdown: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const root = rootRef.current;
      const target = e.target as Node | null;
      if (!root || !target) return;
      if (!root.contains(target)) setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    // Use capture so it still closes even if something stops propagation.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="wm-btn relative h-9 shrink-0 whitespace-nowrap rounded-xl px-3"
      >
        <Bell className="h-4 w-4" />
        Thông báo
        {unreadCount > 0 ? (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgba(var(--danger),0.95)] px-1 text-[11px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[min(420px,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-[rgba(10,14,26,0.85)] p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="text-sm font-semibold text-white">Thông báo</div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={busy || unreadCount === 0}
              className="wm-btn h-8 rounded-xl px-3 text-xs"
            >
              Đánh dấu đã đọc
            </button>
          </div>

          {error ? (
            <div className="mt-2 wm-danger text-xs">
              {error}
            </div>
          ) : null}

          <div className="mt-2 max-h-[60vh] space-y-2 overflow-auto px-1">
            {busy ? (
              <div className="wm-card-2 px-3 py-3 text-sm text-[rgba(232,235,245,0.72)]">
                Đang tải...
              </div>
            ) : items.length ? (
              items.map((n) => (
                <Link
                  key={n.id}
                  href="/tasks"
                  className={`block rounded-2xl border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5 ${
                    n.read_at ? "bg-white/[0.03] text-[rgba(232,235,245,0.82)]" : "bg-white/[0.07] text-white"
                  }`}
                >
                  <div className="font-medium">{n.title}</div>
                  {n.body ? <div className="mt-0.5 text-xs text-[rgba(232,235,245,0.72)]">{n.body}</div> : null}
                  <div className="mt-1 text-[11px] text-[rgba(232,235,245,0.56)]">
                    {n.created_at ? new Date(n.created_at).toLocaleString("vi-VN") : ""}
                  </div>
                </Link>
              ))
            ) : (
              <div className="wm-card-2 px-3 py-3 text-sm text-[rgba(232,235,245,0.72)]">
                Chưa có thông báo.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}



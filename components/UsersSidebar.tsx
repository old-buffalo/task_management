"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users, X } from "lucide-react";
import type { Profile } from "@/lib/types";

type UserRow = Pick<Profile, "id" | "email" | "full_name" | "role" | "team_id">;

const ROLE_LABEL: Record<Profile["role"], string> = {
  truong_phong: "Trưởng phòng",
  pho_phong: "Phó phòng",
  doi_truong: "Đội trưởng",
  doi_pho: "Đội phó",
  can_bo: "Cán bộ",
};

export function UsersSidebar() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((u) => {
      const a = (u.full_name ?? "").toLowerCase();
      const b = (u.email ?? "").toLowerCase();
      return a.includes(s) || b.includes(s);
    });
  }, [items, q]);

  async function loadUsers() {
    setError(null);
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "300");
      const res = await fetch(`/api/users?${qs.toString()}`, { method: "GET" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không tải được danh sách user.");
      }
      const json = (await res.json()) as { users: UserRow[] };
      setItems(json.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadUsers();
    timerRef.current = window.setInterval(() => {
      void loadUsers();
    }, 20000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="wm-btn h-9 shrink-0 whitespace-nowrap rounded-xl px-3"
        aria-label="Open users sidebar"
      >
        <Users className="h-4 w-4" />
        Users
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/20"
            aria-label="Close users sidebar"
            onClick={() => setOpen(false)}
          />

          <aside className="fixed left-0 top-0 z-50 h-dvh w-[min(420px,calc(100vw-3rem))] border-r border-black/10 bg-[rgba(255,255,255,0.85)] p-4 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-black">Danh sách user</div>
                <div className="mt-1 text-xs text-black/60">Hiển thị từ bảng profiles</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="wm-btn h-9 shrink-0 rounded-xl px-3 text-black"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
                Đóng
              </button>
            </div>

            <div className="mt-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo tên / email…"
                className="wm-input"
              />
            </div>

            {error ? <div className="mt-3 wm-danger">{error}</div> : null}

            <div className="mt-3 text-xs text-black/60">
              Tổng: <span className="font-semibold text-black">{filtered.length}</span>
              {busy ? <span className="ml-2">Đang tải…</span> : null}
            </div>

            <div className="mt-3 max-h-[calc(100dvh-10.5rem)] space-y-2 overflow-auto pr-1">
              {filtered.length ? (
                filtered.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3"
                  >
                    <div className="truncate text-sm font-medium text-black">
                      {u.full_name ?? u.email ?? u.id}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-black/60">{u.email ?? ""}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-semibold text-black">
                        {ROLE_LABEL[u.role]}
                      </span>
                      {u.team_id ? (
                        <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] text-black/70">
                          team: {String(u.team_id).slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] text-black/60">
                          no team
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black/70">
                  Không có user.
                </div>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}



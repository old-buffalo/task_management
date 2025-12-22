"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import type { Profile } from "@/lib/types";

type UserRow = Pick<Profile, "id" | "email" | "full_name" | "role" | "team_id">;

const ROLE_LABEL: Record<Profile["role"], string> = {
  truong_phong: "Trưởng phòng",
  pho_phong: "Phó phòng",
  doi_truong: "Đội trưởng",
  doi_pho: "Đội phó",
  can_bo: "Cán bộ",
};

export function UsersSidebarFixed() {
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
    void loadUsers();
    timerRef.current = window.setInterval(() => {
      void loadUsers();
    }, 25000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wm-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-black">
          <Users className="h-4 w-4" />
          Users
        </div>
        <div className="text-xs text-black/60">{busy ? "Đang tải…" : `${filtered.length}`}</div>
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

      <div className="mt-3 max-h-[calc(100dvh-10.5rem)] space-y-2 overflow-auto pr-1">
        {filtered.length ? (
          filtered.map((u) => (
            <div key={u.id} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
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
    </div>
  );
}



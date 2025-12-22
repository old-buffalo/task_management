"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { Profile } from "@/lib/types";

type SessionState =
  | { state: "loading" }
  | { state: "anon" }
  | { state: "authed"; profile: Profile };

export default function WorkspacePage() {
  const [session, setSession] = useState<SessionState>({ state: "loading" });
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

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  if (session.state === "loading") {
    return (
      <div className="wm-bg flex min-h-dvh items-center justify-center">
        <div className="wm-card-2 px-5 py-4 text-sm text-black/70">Đang tải...</div>
      </div>
    );
  }

  if (session.state === "anon") {
    return (
      <div className="wm-bg flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md wm-card p-6">
          <h1 className="text-xl font-semibold tracking-tight text-black">Workspace</h1>
          <p className="mt-2 text-sm text-black/70">Bạn cần đăng nhập để vào khu vực workspace.</p>
          <Link href="/login" className="mt-5 w-full wm-btn-primary">
            Đi tới trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell profile={session.profile}>
      {error ? <div className="wm-danger mb-4">{error}</div> : null}
      <WorkspacePanel />
    </AppShell>
  );
}



"use client";

import { useState } from "react";
import Link from "next/link";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email,
          password,
          full_name: fullName || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Không thực hiện được.");
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wm-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md wm-card p-6 text-black">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-black">
            {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </h1>
          <Link href="/" className="text-sm font-medium text-black hover:opacity-80">
            Home
          </Link>
        </div>

        <p className="mt-2 text-sm text-black">
          {mode === "login"
            ? "Dùng email/password trong Supabase Auth."
            : "Đăng ký nhanh, sau đó có thể gán role/department/team trong Supabase."}
        </p>

        {error ? (
          <div className="mt-4 wm-danger">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          {mode === "signup" ? (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Họ tên (tuỳ chọn)"
              className="wm-input"
            />
          ) : null}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            inputMode="email"
            className="wm-input"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="wm-input"
          />

          <button
            type="button"
            onClick={submit}
            disabled={busy || !email || password.length < 6}
            className="wm-btn-primary"
          >
            {busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="wm-btn text-black"
          >
            {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  );
}



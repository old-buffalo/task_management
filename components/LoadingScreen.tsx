"use client";

export function LoadingScreen({
  label = "Đang tải...",
}: {
  label?: string;
}) {
  return (
    <div className="wm-bg flex min-h-dvh items-center justify-center px-4">
      <div className="wm-card-2 w-full max-w-md px-5 py-4 text-sm text-black/70">
        {label}
      </div>
    </div>
  );
}


import { Suspense } from "react";
import { TasksClient } from "./TasksClient";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="wm-bg flex min-h-dvh items-center justify-center">
          <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Đang tải...
          </div>
        </div>
      }
    >
      <TasksClient />
    </Suspense>
  );
}



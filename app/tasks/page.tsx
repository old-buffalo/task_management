import { Suspense } from "react";
import { TasksClient } from "./TasksClient";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen />
      }
    >
      <TasksClient />
    </Suspense>
  );
}



async function api(path, init) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export async function runAllTests() {
  console.log("1) GET /api/auth");
  try {
    const me = await api("/api/auth", { method: "GET" });
    console.log("OK", me.profile);
  } catch (e) {
    console.warn("Not logged in (expected on fresh setup).", e);
  }

  console.log("2) GET /api/tasks");
  try {
    const tasks = await api("/api/tasks", { method: "GET" });
    console.log("OK", tasks.tasks?.length ?? 0);
  } catch (e) {
    console.warn("Tasks call failed (likely missing Supabase env / auth).", e);
  }
}

export async function seedDemoData() {
  console.log("Create a demo task");
  return await api("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title: "Demo Task", priority: "high" }),
  });
}

export async function getStatistics() {
  const { tasks } = await api("/api/tasks", { method: "GET" });
  const byStatus = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});
  console.log(byStatus);
  return byStatus;
}



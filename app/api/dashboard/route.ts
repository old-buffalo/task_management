import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function createRouteSupabaseClient(request: NextRequest, response: NextResponse) {
  const cfg = getSupabaseConfig();
  if (!cfg) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

type Status = "pending" | "in_progress" | "review" | "completed" | "cancelled";

export async function GET(request: NextRequest) {
  let supabase;
  try {
    const response = NextResponse.json({});
    supabase = createRouteSupabaseClient(request, response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Missing Supabase config" },
      { status: 401 },
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 7);

  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id,status,priority,due_date,created_by,assigned_to,created_at")
    .order("created_at", { ascending: false });
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 400 });

  const byStatus: Record<Status, number> = {
    pending: 0,
    in_progress: 0,
    review: 0,
    completed: 0,
    cancelled: 0,
  };

  let overdue = 0;
  let dueSoon = 0;
  let assignedToMe = 0;
  let createdByMe = 0;

  for (const t of tasks ?? []) {
    const s = t.status as Status;
    if (s in byStatus) byStatus[s] += 1;

    if (t.assigned_to === userData.user.id) assignedToMe += 1;
    if (t.created_by === userData.user.id) createdByMe += 1;

    if (t.due_date && s !== "completed" && s !== "cancelled") {
      const d = new Date(t.due_date);
      if (d.getTime() < now.getTime()) overdue += 1;
      else if (d.getTime() <= soon.getTime()) dueSoon += 1;
    }
  }

  const { count: commentsCount, error: cErr } = await supabase
    .from("task_comments")
    .select("id", { count: "exact", head: true });
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

  const { count: attachmentsCount, error: aErr } = await supabase
    .from("task_attachments")
    .select("id", { count: "exact", head: true });
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

  return NextResponse.json({
    user_id: userData.user.id,
    stats: {
      total: tasks?.length ?? 0,
      assignedToMe,
      createdByMe,
      overdue,
      dueSoon,
      byStatus,
      commentsCount: commentsCount ?? 0,
      attachmentsCount: attachmentsCount ?? 0,
    },
  });
}



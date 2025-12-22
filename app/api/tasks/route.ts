import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const teamId = searchParams.get("teamId");
  const workspaceId = searchParams.get("workspaceId");
  const assignedTo = searchParams.get("assignedTo");
  const createdBy = searchParams.get("createdBy");
  const has = searchParams.get("has"); // comma-separated: comments,attachments
  const qTextRaw = searchParams.get("q");

  let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (teamId) q = q.eq("team_id", teamId);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  if (assignedTo) q = q.eq("assigned_to", assignedTo);
  if (createdBy) q = q.eq("created_by", createdBy);

  const qText = qTextRaw?.trim();
  if (qText) {
    // PostgREST .or() uses comma-separated conditions; avoid breaking it.
    const safe = qText.replaceAll(",", " ").slice(0, 200);
    const pattern = `%${safe}%`;
    q = q.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }

  if (has) {
    const wanted = new Set(
      has
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );

    let ids: string[] | undefined;

    if (wanted.has("comments")) {
      const { data: rows, error: e } = await supabase.from("task_comments").select("task_id");
      if (e) return NextResponse.json({ error: e.message }, { status: 400 });
      const set = new Set<string>(
        (rows ?? [])
          .map((r) => r.task_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      );
      const next = Array.from(set);
      ids = ids ? ids.filter((x) => set.has(x)) : next;
    }

    if (wanted.has("attachments")) {
      const { data: rows, error: e } = await supabase.from("task_attachments").select("task_id");
      if (e) return NextResponse.json({ error: e.message }, { status: 400 });
      const set = new Set<string>(
        (rows ?? [])
          .map((r) => r.task_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      );
      const next = Array.from(set);
      ids = ids ? ids.filter((x) => set.has(x)) : next;
    }

    if (ids) {
      if (!ids.length) return NextResponse.json({ tasks: [] });
      q = q.in("id", ids);
    }
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ tasks: data ?? [] });
}

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  due_date: z.string().datetime().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

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

  const payload = parsed.data;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: payload.title,
      description: payload.description ?? null,
      priority: payload.priority ?? "medium",
      due_date: payload.due_date ?? null,
      status: "pending",
      created_by: userData.user.id,
      assigned_to: payload.assigned_to ?? userData.user.id,
      team_id: payload.team_id ?? null,
      workspace_id: payload.workspace_id ?? null,
      department_id: payload.department_id ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data });
}



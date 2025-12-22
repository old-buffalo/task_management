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
  const unreadOnly = searchParams.get("unread") === "1";
  const limitRaw = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  let q = supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) q = q.is("read_at", null);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const unreadCount = unreadOnly
    ? data?.length ?? 0
    : (
        await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null)
      ).count ?? 0;

  return NextResponse.json({ notifications: data ?? [], unreadCount });
}

const patchSchema = z
  .object({
    action: z.enum(["mark_read", "mark_all_read"]),
    id: z.string().uuid().optional(),
  })
  .strict();

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

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

  const now = new Date().toISOString();

  if (parsed.data.action === "mark_all_read") {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .is("read_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (!parsed.data.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}



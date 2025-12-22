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
  const response = NextResponse.json({});
  let supabase;
  try {
    supabase = createRouteSupabaseClient(request, response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Missing Supabase config" },
      { status: 401 },
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces:workspaces(id,name,owner_id,created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const workspaces =
    (data ?? [])
      .map((row) => {
        const ws = (row as unknown as { workspaces?: Record<string, unknown> | null }).workspaces;
        if (!ws) return null;
        return {
          ...(ws as { id: string; name: string; owner_id?: string | null; created_at?: string }),
          my_role: (row as unknown as { role?: string | null }).role ?? null,
        };
      })
      .filter(Boolean) ?? [];

  return NextResponse.json({ workspaces });
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
});

export async function POST(request: NextRequest) {
  const response = NextResponse.json({});
  let supabase;
  try {
    supabase = createRouteSupabaseClient(request, response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Missing Supabase config" },
      { status: 500 },
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({ name: parsed.data.name, owner_id: userId })
    .select("*")
    .single();
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 400 });

  // Creator becomes highest role in this workspace.
  const { error: memErr } = await supabase.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: userId,
    role: "truong_phong",
  });
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

  return NextResponse.json({ workspace: ws });
}



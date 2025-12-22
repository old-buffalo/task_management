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

const joinSchema = z.object({
  code: z.string().min(8).max(64),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = joinSchema.safeParse(body);
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

  const code = parsed.data.code.trim();

  const { data: team, error: tErr } = await supabase
    .from("teams")
    .select("id,name,department_id,join_code,created_at")
    .eq("join_code", code)
    .maybeSingle();
  if (tErr) {
    if (String(tErr.message).includes("join_code")) {
      return NextResponse.json(
        {
          error:
            "DB chưa có cột teams.join_code. Hãy chạy migration/schema mới (ALTER TABLE teams ADD COLUMN join_code...) rồi thử lại.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: tErr.message }, { status: 400 });
  }
  if (!team) return NextResponse.json({ error: "Mã nhóm không đúng" }, { status: 404 });

  const { error: uErr } = await supabase
    .from("profiles")
    .update({ team_id: team.id })
    .eq("id", userData.user.id);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  return NextResponse.json({ team });
}



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

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  if (!profile?.team_id) return NextResponse.json({ team: null });

  let teamRes = await supabase
    .from("teams")
    .select("id,name,department_id,join_code,created_at")
    .eq("id", profile.team_id)
    .maybeSingle();

  // If DB isn't migrated yet (join_code missing), degrade gracefully.
  if (teamRes.error && String(teamRes.error.message).includes("join_code")) {
    teamRes = await supabase
      .from("teams")
      .select("id,name,department_id,created_at")
      .eq("id", profile.team_id)
      .maybeSingle();
  }

  if (teamRes.error) return NextResponse.json({ error: teamRes.error.message }, { status: 400 });

  return NextResponse.json({ team: teamRes.data ?? null });
}



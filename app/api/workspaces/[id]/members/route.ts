import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { UserRole } from "@/lib/types";

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

const ROLE_ORDER: UserRole[] = ["can_bo", "doi_pho", "doi_truong", "pho_phong", "truong_phong"];
function roleRank(role: UserRole) {
  return ROLE_ORDER.indexOf(role) + 1; // 1..5
}

async function requireAuthed(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabaseClient(request, response);
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Unauthorized");
  return { supabase, userId: data.user.id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;

  let supabase;
  try {
    ({ supabase } = await requireAuthed(request));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id,user_id,role,created_at,user:profiles(id,email,full_name,role)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ members: data ?? [] });
}

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(["truong_phong", "pho_phong", "doi_truong", "doi_pho", "can_bo"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;

  let supabase;
  let userId: string;
  try {
    ({ supabase, userId } = await requireAuthed(request));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  // Ensure requester is a member + has sufficient role rank (doi_pho+), and cannot add higher role than self.
  const { data: me, error: meErr } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });
  if (!me?.role) return NextResponse.json({ error: "Bạn chưa thuộc workspace này." }, { status: 403 });

  const myRole = me.role as UserRole;
  const myRank = roleRank(myRole);
  const targetRole = parsed.data.role as UserRole;
  const targetRank = roleRank(targetRole);

  if (myRank < 2) {
    return NextResponse.json({ error: "Bạn không có quyền thêm thành viên (cần đội phó trở lên)." }, { status: 403 });
  }
  if (targetRank > myRank) {
    return NextResponse.json({ error: "Bạn không thể thêm thành viên có quyền cao hơn bạn." }, { status: 403 });
  }

  // Lookup target user by email in profiles (requires user has logged in at least once).
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .ilike("email", parsed.data.email)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
  if (!profile?.id) {
    return NextResponse.json(
      { error: "Không tìm thấy user theo email. User cần đăng nhập ít nhất 1 lần để có profile." },
      { status: 404 },
    );
  }

  const { error: insErr } = await supabase.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: profile.id,
    role: targetRole,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}



import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const BUCKET = "task-attachments";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function getServiceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
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

function createAdminSupabaseClient() {
  const cfg = getServiceConfig();
  if (!cfg) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(cfg.url, cfg.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureBucket(admin: ReturnType<typeof createAdminSupabaseClient>) {
  const { data, error } = await admin.storage.getBucket(BUCKET);
  if (!error && data) return;

  const { error: createErr } = await admin.storage.createBucket(BUCKET, {
    public: false,
  });
  if (createErr && !String(createErr.message).toLowerCase().includes("already exists")) {
    throw new Error(createErr.message);
  }
}

async function assertTaskAccess({
  request,
  taskId,
}: {
  request: NextRequest;
  taskId: string;
}): Promise<{ supabase: ReturnType<typeof createRouteSupabaseClient>; userId: string }> {
  const response = NextResponse.json({});
  const supabase = createRouteSupabaseClient(request, response);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Unauthorized");

  // Rely on tasks RLS (creator/assignee) to confirm access.
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error("Not found");

  return { supabase, userId: userData.user.id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;

  let supabase: ReturnType<typeof createRouteSupabaseClient>;
  try {
    ({ supabase } = await assertTaskAccess({ request, taskId }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : msg === "Not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  // Use admin to generate signed URLs for comment attachments (if configured).
  let admin: ReturnType<typeof createAdminSupabaseClient> | null = null;
  try {
    admin = createAdminSupabaseClient();
    await ensureBucket(admin);
  } catch {
    admin = null;
  }

  const { data, error } = await (admin ?? supabase)
    .from("task_comments")
    .select("*, author:profiles(full_name,email,role), attachment:task_attachments!task_comments_attachment_id_fkey(*)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = [];
  for (const c of data ?? []) {
    const attachment = c.attachment ?? null;
    if (!admin || !attachment?.storage_path) {
      items.push({ ...c, attachment: attachment ? { ...attachment, url: null } : null });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(attachment.storage_path, 60 * 60);

    items.push({
      ...c,
      attachment: { ...attachment, url: signErr ? null : signed?.signedUrl ?? null },
    });
  }

  return NextResponse.json({ comments: items });
}

const createSchema = z.object({
  content: z.string().min(1).max(2000),
  attachmentId: z.string().uuid().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  let supabase;
  let userId: string;
  try {
    ({ supabase, userId } = await assertTaskAccess({ request, taskId }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : msg === "Not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  const attachmentId = parsed.data.attachmentId ?? null;
  if (attachmentId) {
    const { data: att, error: attErr } = await supabase
      .from("task_attachments")
      .select("id, task_id, uploader_id")
      .eq("id", attachmentId)
      .maybeSingle();
    if (attErr) return NextResponse.json({ error: attErr.message }, { status: 400 });
    if (!att || att.task_id !== taskId || att.uploader_id !== userId) {
      return NextResponse.json({ error: "Invalid attachmentId" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_id: userId,
      content: parsed.data.content,
      attachment_id: attachmentId,
    })
    .select("*, author:profiles(full_name,email,role), attachment:task_attachments!task_comments_attachment_id_fkey(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Attach signed URL if available.
  let out = data;
  if (data?.attachment?.storage_path) {
    try {
      const admin = createAdminSupabaseClient();
      await ensureBucket(admin);
      const { data: signed, error: signErr } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(data.attachment.storage_path, 60 * 60);
      out = { ...data, attachment: { ...data.attachment, url: signErr ? null : signed?.signedUrl ?? null } };
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ comment: out });
}



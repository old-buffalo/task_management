import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const BUCKET = "task-attachments";

function getPublicConfig() {
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

function createSessionSupabaseClient(request: NextRequest, response: NextResponse) {
  const cfg = getPublicConfig();
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
  if (!cfg) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (required for uploads)");
  return createClient(cfg.url, cfg.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertTaskAccess({
  request,
  taskId,
}: {
  request: NextRequest;
  taskId: string;
}): Promise<{ userId: string }> {
  const response = NextResponse.json({});
  const supabase = createSessionSupabaseClient(request, response);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Unauthorized");

  // Rely on tasks RLS to enforce access (creator/assignee by default in schema.sql).
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error("Not found");

  return { userId: userData.user.id };
}

async function ensureBucket(admin: ReturnType<typeof createAdminSupabaseClient>) {
  const { data, error } = await admin.storage.getBucket(BUCKET);
  if (!error && data) return;

  // If not found, create it (private by default). We'll serve via signed URLs.
  const { error: createErr } = await admin.storage.createBucket(BUCKET, {
    public: false,
  });
  if (createErr && !String(createErr.message).toLowerCase().includes("already exists")) {
    throw new Error(createErr.message);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;

  try {
    await assertTaskAccess({ request, taskId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : msg === "Not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  let admin;
  try {
    admin = createAdminSupabaseClient();
    await ensureBucket(admin);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Missing upload config" },
      { status: 500 },
    );
  }

  const { data: attachments, error } = await admin
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = [];
  for (const a of attachments ?? []) {
    // eslint-disable-next-line no-await-in-loop
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(a.storage_path, 60 * 60);
    items.push({
      ...a,
      url: signErr ? null : signed?.signedUrl ?? null,
    });
  }

  return NextResponse.json({ attachments: items });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;

  let userId: string;
  try {
    ({ userId } = await assertTaskAccess({ request, taskId }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : msg === "Not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size <= 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminSupabaseClient();
    await ensureBucket(admin);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Missing upload config" },
      { status: 500 },
    );
  }

  const safeName = (file.name || "file").replaceAll("\\", "_").replaceAll("/", "_");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "";
  const unique = crypto.randomUUID();
  const path = `tasks/${taskId}/${unique}${ext ? `.${ext}` : ""}`;

  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 400 });

  const { data: attachment, error: insErr } = await admin
    .from("task_attachments")
    .insert({
      task_id: taskId,
      uploader_id: userId,
      storage_path: path,
      file_name: safeName,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);

  return NextResponse.json({
    attachment: { ...attachment, url: signed?.signedUrl ?? null },
  });
}



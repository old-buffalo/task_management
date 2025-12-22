import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Prefer .env.local for this project.
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env.local" });

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function makeAdminClient() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureDepartment(name) {
  const supabase = makeAdminClient();
  const { data: existing, error: selErr } = await supabase
    .from("departments")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("departments")
    .insert({ name })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function ensureTeam(departmentId, name) {
  const supabase = makeAdminClient();
  const { data: existing, error: selErr } = await supabase
    .from("teams")
    .select("*")
    .eq("department_id", departmentId)
    .eq("name", name)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("teams")
    .insert({ department_id: departmentId, name })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function listUsersByEmail(emails) {
  const supabase = makeAdminClient();
  const wanted = new Set(emails.map((e) => e.toLowerCase()));
  const out = new Map();

  // Supabase admin list users is paginated
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) {
      if (!u.email) continue;
      const e = u.email.toLowerCase();
      if (wanted.has(e)) out.set(e, u);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return out;
}

async function upsertProfile({
  id,
  email,
  full_name,
  role,
  department_id,
  team_id,
}) {
  const supabase = makeAdminClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      id,
      email,
      full_name,
      role,
      department_id,
      team_id,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function ensureUser({ email, full_name, role, department_id, team_id }) {
  const supabase = makeAdminClient();
  const password = process.env.SEED_PASSWORD || "Test@123456";
  const lower = email.toLowerCase();

  const existing = (await listUsersByEmail([email])).get(lower);
  if (existing) {
    // Make sure password is known + email confirmed for dev.
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { full_name },
      email_confirm: true,
    });
    if (error) throw error;

    await upsertProfile({
      id: existing.id,
      email,
      full_name,
      role,
      department_id,
      team_id,
    });
    return { id: existing.id, email };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) throw error;

  await upsertProfile({
    id: data.user.id,
    email,
    full_name,
    role,
    department_id,
    team_id,
  });

  return { id: data.user.id, email };
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomDueDateIso() {
  // +/- 30 days
  const days = randomInt(-10, 30);
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function randomPastIso({ maxDaysAgo }) {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, maxDaysAgo));
  d.setHours(randomInt(8, 20), randomInt(0, 59), 0, 0);
  return d.toISOString();
}

async function seedTasks({ department_id, team_id, users }) {
  const supabase = makeAdminClient();
  const count = Number.parseInt(process.env.SEED_TASKS_COUNT || "10", 10) || 10;

  const statuses = ["pending", "in_progress", "review", "completed", "cancelled"];
  const priorities = ["low", "medium", "high", "urgent"];

  // Ensure good coverage across statuses by cycling them, then shuffling.
  const statusPlan = shuffle(
    Array.from({ length: count }, (_, i) => statuses[i % statuses.length]),
  );

  const titlePool = [
    "Chuẩn hóa quy trình",
    "Triển khai tính năng mới",
    "Fix bug production",
    "Thiết kế UI mobile-first",
    "Tối ưu hiệu năng API",
    "Viết tài liệu hướng dẫn",
    "Review PR & refactor",
    "Chuẩn bị báo cáo tuần",
    "Tích hợp Supabase RLS",
    "Kiểm thử end-to-end",
  ];

  const tasks = Array.from({ length: count }, (_, i) => {
    const status = statusPlan[i];
    const priority = randomChoice(priorities);
    const creator = randomChoice(users).id;
    const assignee = randomChoice(users).id;

    const baseTitle = randomChoice(titlePool);
    const title = `#${String(i + 1).padStart(2, "0")} ${baseTitle}`;

    const t = {
      title,
      description: `Task demo sinh ngẫu nhiên để test UI/API. (${status}/${priority})`,
      status,
      priority,
      due_date: randomDueDateIso(),
      created_by: creator,
      assigned_to: assignee,
      department_id,
      team_id,
      rating: null,
      review_comment: null,
    };

    if (status === "completed") {
      t.rating = randomInt(3, 5);
      t.review_comment = "Hoàn thành tốt (demo).";
    }
    if (status === "review") {
      t.review_comment = "Đang chờ review (demo).";
    }

    return t;
  });

  const { error } = await supabase.from("tasks").insert(tasks);
  if (error) throw error;
}

async function seedTeamInProgressTasks({ department_id, team, users }) {
  const supabase = makeAdminClient();
  const count = Number.parseInt(process.env.SEED_TEAM_INPROGRESS_COUNT || "6", 10) || 6;

  const assignees = users.map((u) => u.id);
  if (!assignees.length) return;

  const tasks = Array.from({ length: count }, (_, i) => ({
    title: `TEAM ${team.name}: In-progress #${i + 1}`,
    description: `Task team demo để test “Công việc nhóm đang thực hiện”.`,
    status: "in_progress",
    priority: randomChoice(["low", "medium", "high", "urgent"]),
    due_date: randomDueDateIso(),
    created_by: randomChoice(assignees),
    assigned_to: randomChoice(assignees),
    department_id,
    team_id: team.id,
  }));

  const { error } = await supabase.from("tasks").insert(tasks);
  if (error) throw error;
}

async function seedNotifications({ users }) {
  const supabase = makeAdminClient();
  const perUser = Number.parseInt(process.env.SEED_NOTIFICATIONS_PER_USER || "6", 10) || 6;

  const titles = [
    "Bạn được giao công việc mới",
    "Công việc cập nhật trạng thái",
    "Bình luận mới",
    "File đính kèm mới",
    "Nhắc nhở deadline",
    "Cập nhật từ nhóm",
  ];

  const bodies = [
    "Task: Demo task #01",
    "Task: TEAM Đội A: In-progress #2",
    "Có cập nhật mới trên công việc bạn theo dõi.",
    "Vui lòng kiểm tra tiến độ trước deadline.",
    "Một thành viên vừa cập nhật nội dung.",
    "Có tệp mới được tải lên.",
  ];

  const rows = [];
  for (const u of users) {
    for (let i = 0; i < perUser; i += 1) {
      const unread = i % 3 !== 0; // ~2/3 unread
      rows.push({
        user_id: u.id,
        title: randomChoice(titles),
        body: randomChoice(bodies),
        read_at: unread ? null : randomPastIso({ maxDaysAgo: 3 }),
        created_at: randomPastIso({ maxDaysAgo: 7 }),
      });
    }
  }

  if (!rows.length) return;

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
}

async function main() {
  // Fail-fast with a friendly message (instead of a stack trace).
  // We *require* the service role key to create users programmatically.
  mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const password = process.env.SEED_PASSWORD || "Test@123456";

  const dept = await ensureDepartment("Phòng Kỹ Thuật");
  const teamA = await ensureTeam(dept.id, "Đội A");
  const teamB = await ensureTeam(dept.id, "Đội B");

  const specs = [
    {
      email: "admin@test.com",
      full_name: "Trưởng phòng (Demo)",
      role: "truong_phong",
      department_id: dept.id,
      team_id: teamA.id,
    },
    {
      email: "pho_phong@test.com",
      full_name: "Phó phòng (Demo)",
      role: "pho_phong",
      department_id: dept.id,
      team_id: teamB.id,
    },
    {
      email: "doi_truong@test.com",
      full_name: "Đội trưởng (Demo)",
      role: "doi_truong",
      department_id: dept.id,
      team_id: teamA.id,
    },
    {
      email: "doi_pho@test.com",
      full_name: "Đội phó (Demo)",
      role: "doi_pho",
      department_id: dept.id,
      // Leave empty so this user can test joining via join_code.
      team_id: null,
    },
    {
      email: "can_bo@test.com",
      full_name: "Cán bộ (Demo)",
      role: "can_bo",
      department_id: dept.id,
      // Leave empty so this user can test joining via join_code.
      team_id: null,
    },
  ];

  const users = [];
  for (const s of specs) {
    const u = await ensureUser(s);
    users.push(u);
  }

  // Random tasks not tied to a team (still useful for general testing).
  await seedTasks({ department_id: dept.id, team_id: null, users });

  // Team-specific tasks that should show up in the "team in progress" section.
  const teamAUsers = users.filter((u) =>
    ["admin@test.com", "doi_truong@test.com"].includes(u.email),
  );
  const teamBUsers = users.filter((u) => ["pho_phong@test.com"].includes(u.email));
  await seedTeamInProgressTasks({ department_id: dept.id, team: teamA, users: teamAUsers });
  await seedTeamInProgressTasks({ department_id: dept.id, team: teamB, users: teamBUsers });

  // Notifications demo (for bell dropdown testing)
  await seedNotifications({ users });

  console.log("\nSeeded demo accounts:");
  for (const s of specs) {
    console.log(`- ${s.email} (${s.role})`);
  }
  console.log("\nDemo teams:");
  console.log(`- ${teamA.name}: join_code = ${teamA.join_code ?? "(missing join_code - apply latest schema)"} (members: admin@test.com, doi_truong@test.com)`);
  console.log(`- ${teamB.name}: join_code = ${teamB.join_code ?? "(missing join_code - apply latest schema)"} (members: pho_phong@test.com)`);
  console.log("\nUsers WITHOUT a team (to test join flow): doi_pho@test.com, can_bo@test.com");
  console.log(`\nPassword: ${password}`);
  console.log("\nLogin at: http://localhost:3000/login");
}

main().catch((e) => {
  console.error("\nSeed failed:");
  console.error(e?.message ?? e);
  console.error("\nNotes:");
  console.error("- Make sure DB schema is applied: database/schema.sql and database/triggers.sql");
  console.error("- Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.local (Supabase Dashboard → Project Settings → API → service_role key)");
  console.error("- If using local Supabase CLI: run npm run supabase:start && npm run supabase:env");
  process.exit(1);
});



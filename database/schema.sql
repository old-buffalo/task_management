-- Work Management schema (Supabase / Postgres)
-- Chạy file này trong Supabase SQL editor.

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type user_role as enum ('truong_phong','pho_phong','doi_truong','doi_pho','can_bo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('pending','in_progress','review','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type priority_level as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

-- Role rank helper (for workspace/team permission comparisons)
create or replace function public.user_role_rank(r user_role)
returns int
language sql
immutable
as $$
  select case r
    when 'truong_phong' then 5
    when 'pho_phong' then 4
    when 'doi_truong' then 3
    when 'doi_pho' then 2
    else 1
  end;
$$;

-- Core tables
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id) on delete set null,
  name text not null,
  join_code text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_teams_join_code_unique on teams(join_code);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role user_role not null default 'can_bo',
  department_id uuid references departments(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspaces (collaboration)
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role user_role not null default 'can_bo',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user_id on workspace_members(user_id);
create index if not exists idx_workspace_members_workspace_id on workspace_members(workspace_id);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status task_status not null default 'pending',
  priority priority_level not null default 'medium',
  due_date timestamptz,
  rating int check (rating between 1 and 5),
  review_comment text,

  department_id uuid references departments(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  workspace_id uuid references workspaces(id) on delete set null,

  created_by uuid references profiles(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  assigned_by uuid references profiles(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  attachment_id uuid references task_attachments(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task_id_created_at
  on task_comments(task_id, created_at desc);

create index if not exists idx_task_comments_attachment_id
  on task_comments(attachment_id);

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  uploader_id uuid references profiles(id) on delete set null,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_attachments_task_id_created_at
  on task_attachments(task_id, created_at desc);

create table if not exists task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes (basic)
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_assigned_to on tasks(assigned_to);
create index if not exists idx_tasks_team_id on tasks(team_id);
create index if not exists idx_tasks_department_id on tasks(department_id);
create index if not exists idx_tasks_workspace_id on tasks(workspace_id);
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_user_unread on notifications(user_id, read_at);

-- RLS templates
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_attachments enable row level security;
alter table task_history enable row level security;
alter table notifications enable row level security;

-- Profiles: basic policies
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (true);

-- Allow user to create their own profile row (used by /api/auth GET on first login).
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Workspaces: members can read; owner can manage workspace
drop policy if exists "workspaces_select_member" on workspaces;
create policy "workspaces_select_member" on workspaces
  for select using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
    )
  );

drop policy if exists "workspaces_insert_owner" on workspaces;
create policy "workspaces_insert_owner" on workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists "workspaces_update_owner" on workspaces;
create policy "workspaces_update_owner" on workspaces
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Workspace members: anyone in workspace can read members.
drop policy if exists "workspace_members_select_in_workspace" on workspace_members;
create policy "workspace_members_select_in_workspace" on workspace_members
  for select using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid()
    )
  );

-- Managers (doi_pho+) can add members, but cannot add someone with higher role than themselves.
drop policy if exists "workspace_members_insert_by_manager" on workspace_members;
create policy "workspace_members_insert_by_manager" on workspace_members
  for insert with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and public.user_role_rank(wm.role) >= 2
        and public.user_role_rank(wm.role) >= public.user_role_rank(workspace_members.role)
    )
  );

drop policy if exists "workspace_members_update_by_manager" on workspace_members;
create policy "workspace_members_update_by_manager" on workspace_members
  for update using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and public.user_role_rank(wm.role) >= 2
        and public.user_role_rank(wm.role) >= public.user_role_rank(workspace_members.role)
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and public.user_role_rank(wm.role) >= 2
        and public.user_role_rank(wm.role) >= public.user_role_rank(workspace_members.role)
    )
  );

drop policy if exists "workspace_members_delete_by_manager" on workspace_members;
create policy "workspace_members_delete_by_manager" on workspace_members
  for delete using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and public.user_role_rank(wm.role) >= 2
        and public.user_role_rank(wm.role) >= public.user_role_rank(workspace_members.role)
    )
  );

-- Tasks: minimal policies (sane default)
-- Bạn có thể thay bằng policy theo role/department/team như mô tả README.
drop policy if exists "tasks_select_in_scope" on tasks;
create policy "tasks_select_in_scope" on tasks
  for select using (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or (
      team_id is not null
      and team_id = (select profiles.team_id from profiles where profiles.id = auth.uid())
    )
    or (
      workspace_id is not null
      and exists (
        select 1 from workspace_members wm
        where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "tasks_insert_any_authed" on tasks;
create policy "tasks_insert_any_authed" on tasks
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "tasks_update_owner_or_assignee" on tasks;
create policy "tasks_update_owner_or_assignee" on tasks
  for update using (
    created_by = auth.uid()
    or assigned_to = auth.uid()
  );

-- Delete: only allow if creator (bạn có thể thay bằng role managers)
drop policy if exists "tasks_delete_creator" on tasks;
create policy "tasks_delete_creator" on tasks
  for delete using (created_by = auth.uid());

-- Task comments: allow users in task scope to read/write comments.
drop policy if exists "task_comments_select_in_scope" on task_comments;
create policy "task_comments_select_in_scope" on task_comments
  for select using (
    exists (
      select 1 from tasks
      where tasks.id = task_comments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assigned_to = auth.uid()
          or (
            tasks.team_id is not null
            and tasks.team_id = (select profiles.team_id from profiles where profiles.id = auth.uid())
          )
          or (
            tasks.workspace_id is not null
            and exists (
              select 1 from workspace_members wm
              where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "task_comments_insert_in_scope" on task_comments;
create policy "task_comments_insert_in_scope" on task_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from tasks
      where tasks.id = task_comments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assigned_to = auth.uid()
          or (
            tasks.team_id is not null
            and tasks.team_id = (select profiles.team_id from profiles where profiles.id = auth.uid())
          )
          or (
            tasks.workspace_id is not null
            and exists (
              select 1 from workspace_members wm
              where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "task_comments_update_own" on task_comments;
create policy "task_comments_update_own" on task_comments
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "task_comments_delete_own" on task_comments;
create policy "task_comments_delete_own" on task_comments
  for delete using (author_id = auth.uid());

-- Task attachments: allow users in task scope to read metadata of attachments.
drop policy if exists "task_attachments_select_in_scope" on task_attachments;
create policy "task_attachments_select_in_scope" on task_attachments
  for select using (
    exists (
      select 1 from tasks
      where tasks.id = task_attachments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assigned_to = auth.uid()
          or (
            tasks.team_id is not null
            and tasks.team_id = (select profiles.team_id from profiles where profiles.id = auth.uid())
          )
          or (
            tasks.workspace_id is not null
            and exists (
              select 1 from workspace_members wm
              where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- Optional: if you later switch to client-side direct upload + insert, these help.
drop policy if exists "task_attachments_insert_in_scope" on task_attachments;
create policy "task_attachments_insert_in_scope" on task_attachments
  for insert with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from tasks
      where tasks.id = task_attachments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assigned_to = auth.uid()
          or (
            tasks.team_id is not null
            and tasks.team_id = (select profiles.team_id from profiles where profiles.id = auth.uid())
          )
          or (
            tasks.workspace_id is not null
            and exists (
              select 1 from workspace_members wm
              where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists "task_attachments_delete_own" on task_attachments;
create policy "task_attachments_delete_own" on task_attachments
  for delete using (uploader_id = auth.uid());

-- Notifications: user sees and marks own notifications.
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage note (manual step):
-- Create bucket: task-attachments
-- This project serves files via signed URLs from a private bucket (recommended).



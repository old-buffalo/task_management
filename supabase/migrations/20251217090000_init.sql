-- Local Supabase migration for Work Management
-- Source: database/schema.sql + database/triggers.sql

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
  content text not null,
  created_at timestamptz not null default now()
);

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
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_user_unread on notifications(user_id, read_at);

-- RLS templates
alter table profiles enable row level security;
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

-- Tasks: minimal policies (sane default)
drop policy if exists "tasks_select_in_scope" on tasks;
create policy "tasks_select_in_scope" on tasks
  for select using (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or (
      team_id is not null
      and team_id = (select profiles.team_id from profiles where profiles.id = auth.uid())
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
        and (tasks.created_by = auth.uid() or tasks.assigned_to = auth.uid())
    )
  );

drop policy if exists "task_comments_insert_in_scope" on task_comments;
create policy "task_comments_insert_in_scope" on task_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from tasks
      where tasks.id = task_comments.task_id
        and (tasks.created_by = auth.uid() or tasks.assigned_to = auth.uid())
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
        and (tasks.created_by = auth.uid() or tasks.assigned_to = auth.uid())
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
        and (tasks.created_by = auth.uid() or tasks.assigned_to = auth.uid())
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

-- Triggers / functions
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- Notifications
create or replace function public.notify_insert(_user_id uuid, _title text, _body text)
returns void
language plpgsql
as $$
begin
  if _user_id is null then
    return;
  end if;

  insert into public.notifications(user_id, title, body)
  values (_user_id, _title, _body);
end;
$$;

create or replace function public.notify_task_events()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
begin
  actor := auth.uid();

  if (tg_op = 'INSERT') then
    -- Notify assignee when a task is created (if different from creator).
    if new.assigned_to is not null and new.assigned_to <> new.created_by then
      perform public.notify_insert(
        new.assigned_to,
        'Bạn được giao công việc mới',
        coalesce(new.title, 'Công việc') || ' (status: ' || new.status::text || ')'
      );
    end if;
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    -- Notify new assignee when reassigned.
    if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
      if new.assigned_to <> actor then
        perform public.notify_insert(
          new.assigned_to,
          'Bạn được giao công việc',
          coalesce(new.title, 'Công việc') || ' (được giao lại)'
        );
      end if;
    end if;

    -- Notify counterpart on status change (creator/assignee).
    if new.status is distinct from old.status then
      if new.created_by is not null and new.created_by <> actor then
        perform public.notify_insert(
          new.created_by,
          'Công việc cập nhật trạng thái',
          coalesce(new.title, 'Công việc') || ': ' || old.status::text || ' → ' || new.status::text
        );
      end if;
      if new.assigned_to is not null and new.assigned_to <> actor then
        perform public.notify_insert(
          new.assigned_to,
          'Công việc cập nhật trạng thái',
          coalesce(new.title, 'Công việc') || ': ' || old.status::text || ' → ' || new.status::text
        );
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_on_task_insert on public.tasks;
create trigger notify_on_task_insert
after insert on public.tasks
for each row execute function public.notify_task_events();

drop trigger if exists notify_on_task_update on public.tasks;
create trigger notify_on_task_update
after update on public.tasks
for each row execute function public.notify_task_events();

create or replace function public.notify_task_comment()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
  t record;
begin
  actor := auth.uid();
  select id, title, created_by, assigned_to into t from public.tasks where id = new.task_id;

  if t.created_by is not null and t.created_by <> actor then
    perform public.notify_insert(
      t.created_by,
      'Bình luận mới',
      'Task: ' || coalesce(t.title, 'Công việc')
    );
  end if;
  if t.assigned_to is not null and t.assigned_to <> actor then
    perform public.notify_insert(
      t.assigned_to,
      'Bình luận mới',
      'Task: ' || coalesce(t.title, 'Công việc')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_on_task_comment_insert on public.task_comments;
create trigger notify_on_task_comment_insert
after insert on public.task_comments
for each row execute function public.notify_task_comment();

create or replace function public.notify_task_attachment()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
  t record;
begin
  actor := auth.uid();
  select id, title, created_by, assigned_to into t from public.tasks where id = new.task_id;

  if t.created_by is not null and t.created_by <> actor then
    perform public.notify_insert(
      t.created_by,
      'File đính kèm mới',
      'Task: ' || coalesce(t.title, 'Công việc')
    );
  end if;
  if t.assigned_to is not null and t.assigned_to <> actor then
    perform public.notify_insert(
      t.assigned_to,
      'File đính kèm mới',
      'Task: ' || coalesce(t.title, 'Công việc')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_on_task_attachment_insert on public.task_attachments;
create trigger notify_on_task_attachment_insert
after insert on public.task_attachments
for each row execute function public.notify_task_attachment();


-- New features migration (incremental):
-- teams.join_code + task_comments + task_attachments + notifications + notification triggers
-- Safe to run on an existing DB: uses IF NOT EXISTS / create or replace / drop + create policies.

-- Extensions
create extension if not exists "pgcrypto";

-- Teams: add join_code for join flow (if teams already exists without join_code)
alter table if exists public.teams
  add column if not exists join_code text not null default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists idx_teams_join_code_unique on public.teams(join_code);

-- Comments
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task_id_created_at
  on public.task_comments(task_id, created_at desc);

-- Attachments metadata (files stored in Supabase Storage bucket: task-attachments)
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploader_id uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_attachments_task_id_created_at
  on public.task_attachments(task_id, created_at desc);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read_at);

-- RLS
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.notifications enable row level security;

-- Policies: comments in task scope (creator/assignee/team member)
drop policy if exists "task_comments_select_in_scope" on public.task_comments;
create policy "task_comments_select_in_scope" on public.task_comments
  for select using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_comments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assigned_to = auth.uid()
          or (
            tasks.team_id is not null
            and tasks.team_id = (select profiles.team_id from public.profiles where profiles.id = auth.uid())
          )
        )
    )
  );

drop policy if exists "task_comments_insert_in_scope" on public.task_comments;
create policy "task_comments_insert_in_scope" on public.task_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tasks
      where tasks.id = task_comments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assigned_to = auth.uid()
          or (
            tasks.team_id is not null
            and tasks.team_id = (select profiles.team_id from public.profiles where profiles.id = auth.uid())
          )
        )
    )
  );

drop policy if exists "task_comments_update_own" on public.task_comments;
create policy "task_comments_update_own" on public.task_comments
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "task_comments_delete_own" on public.task_comments;
create policy "task_comments_delete_own" on public.task_comments
  for delete using (author_id = auth.uid());

-- Policies: attachments metadata in task scope (creator/assignee/team member)
drop policy if exists "task_attachments_select_in_scope" on public.task_attachments;
create policy "task_attachments_select_in_scope" on public.task_attachments
  for select using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_attachments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assigned_to = auth.uid()
          or (
            tasks.team_id is not null
            and tasks.team_id = (select profiles.team_id from public.profiles where profiles.id = auth.uid())
          )
        )
    )
  );

drop policy if exists "task_attachments_insert_in_scope" on public.task_attachments;
create policy "task_attachments_insert_in_scope" on public.task_attachments
  for insert with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.tasks
      where tasks.id = task_attachments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assigned_to = auth.uid()
          or (
            tasks.team_id is not null
            and tasks.team_id = (select profiles.team_id from public.profiles where profiles.id = auth.uid())
          )
        )
    )
  );

drop policy if exists "task_attachments_delete_own" on public.task_attachments;
create policy "task_attachments_delete_own" on public.task_attachments
  for delete using (uploader_id = auth.uid());

-- Policies: notifications (own)
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Notification triggers/functions
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
    if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
      if new.assigned_to <> actor then
        perform public.notify_insert(
          new.assigned_to,
          'Bạn được giao công việc',
          coalesce(new.title, 'Công việc') || ' (được giao lại)'
        );
      end if;
    end if;

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



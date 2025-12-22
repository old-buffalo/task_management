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



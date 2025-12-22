-- Hotfix: allow inserting comments for tasks in scope (creator/assignee/team member)
-- Fixes: new row violates row-level security policy for table "task_comments"

alter table public.task_comments enable row level security;

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



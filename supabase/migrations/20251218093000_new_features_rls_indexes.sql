-- Sync RLS policies for "new features" tables (comments/attachments) to include team-scope access.
-- Also add helpful indexes for ordering by created_at.

-- Indexes (safe / idempotent)
create index if not exists idx_task_comments_task_id_created_at
  on public.task_comments(task_id, created_at desc);

create index if not exists idx_task_attachments_task_id_created_at
  on public.task_attachments(task_id, created_at desc);

-- Comments: include team scope
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

-- Attachments: include team scope (metadata access + optional insert policy)
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



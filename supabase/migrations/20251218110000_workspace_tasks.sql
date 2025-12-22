-- Workspace shared tasks:
-- Add tasks.workspace_id and extend RLS for tasks/comments/attachments to include workspace membership.

alter table public.tasks
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

create index if not exists idx_tasks_workspace_id on public.tasks(workspace_id);

-- Tasks: allow workspace members to see workspace tasks
drop policy if exists "tasks_select_in_scope" on public.tasks;
create policy "tasks_select_in_scope" on public.tasks
  for select using (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or (
      team_id is not null
      and team_id = (select profiles.team_id from public.profiles where profiles.id = auth.uid())
    )
    or (
      workspace_id is not null
      and exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
      )
    )
  );

-- Comments: allow users in task scope (creator/assignee/team member/workspace member) to read/write
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
          or (
            tasks.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
            )
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
          or (
            tasks.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- Attachments metadata: include workspace scope
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
          or (
            tasks.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
            )
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
          or (
            tasks.workspace_id is not null
            and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid()
            )
          )
        )
    )
  );



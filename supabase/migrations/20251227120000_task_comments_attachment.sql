-- Add optional attachment per comment (reuses task_attachments table)

alter table public.task_comments
  add column if not exists attachment_id uuid;

-- FK: a comment can reference a task attachment (same task)
alter table public.task_comments
  drop constraint if exists task_comments_attachment_id_fkey;
alter table public.task_comments
  add constraint task_comments_attachment_id_fkey
  foreign key (attachment_id)
  references public.task_attachments(id)
  on delete set null;

create index if not exists idx_task_comments_attachment_id on public.task_comments(attachment_id);

-- Update insert policy to allow attachment_id only when it belongs to this task and uploaded by the author.
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
    and (
      attachment_id is null
      or exists (
        select 1 from public.task_attachments ta
        where ta.id = task_comments.attachment_id
          and ta.task_id = task_comments.task_id
          and ta.uploader_id = auth.uid()
      )
    )
  );


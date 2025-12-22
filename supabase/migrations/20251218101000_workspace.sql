-- Workspace feature (team collaboration):
-- tables: workspaces, workspace_members
-- RLS: member read, manager add/manage members with role hierarchy

create extension if not exists "pgcrypto";

-- Role rank helper
create or replace function public.user_role_rank(r public.user_role)
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

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'can_bo',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);
create index if not exists idx_workspace_members_workspace_id on public.workspace_members(workspace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Workspaces
drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member" on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
    )
  );

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner" on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner" on public.workspaces
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Workspace members
drop policy if exists "workspace_members_select_in_workspace" on public.workspace_members;
create policy "workspace_members_select_in_workspace" on public.workspace_members
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid()
    )
  );

-- Managers (doi_pho+) can add members, but cannot add someone with higher role than themselves.
drop policy if exists "workspace_members_insert_by_manager" on public.workspace_members;
create policy "workspace_members_insert_by_manager" on public.workspace_members
  for insert with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and public.user_role_rank(wm.role) >= 2
        and public.user_role_rank(wm.role) >= public.user_role_rank(workspace_members.role)
    )
  );

drop policy if exists "workspace_members_update_by_manager" on public.workspace_members;
create policy "workspace_members_update_by_manager" on public.workspace_members
  for update using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and public.user_role_rank(wm.role) >= 2
        and public.user_role_rank(wm.role) >= public.user_role_rank(workspace_members.role)
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and public.user_role_rank(wm.role) >= 2
        and public.user_role_rank(wm.role) >= public.user_role_rank(workspace_members.role)
    )
  );

drop policy if exists "workspace_members_delete_by_manager" on public.workspace_members;
create policy "workspace_members_delete_by_manager" on public.workspace_members
  for delete using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and public.user_role_rank(wm.role) >= 2
        and public.user_role_rank(wm.role) >= public.user_role_rank(workspace_members.role)
    )
  );



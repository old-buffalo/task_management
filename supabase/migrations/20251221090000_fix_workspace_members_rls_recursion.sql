-- Fix: infinite recursion detected in policy for relation "workspace_members"
-- Cause: RLS policies on workspace_members queried workspace_members again via EXISTS,
-- which triggers the policy recursively.
--
-- Solution: move membership/role checks into SECURITY DEFINER helper functions
-- (owned by the migration role), then reference those functions in policies.

-- Helper: is workspace owner?
create or replace function public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.workspaces w
    where w.id = _workspace_id
      and w.owner_id = _user_id
  );
$$;

-- Helper: is member (bypasses RLS to avoid recursion)
create or replace function public.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.workspace_members wm
    where wm.workspace_id = _workspace_id
      and wm.user_id = _user_id
  );
$$;

-- Helper: actor's role rank inside a workspace (defaults to can_bo if not a member)
create or replace function public.workspace_actor_role_rank(_workspace_id uuid, _actor_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select public.user_role_rank(
    coalesce(
      (
        select wm.role
        from public.workspace_members wm
        where wm.workspace_id = _workspace_id
          and wm.user_id = _actor_id
        limit 1
      ),
      'can_bo'::public.user_role
    )
  );
$$;

-- Helper: can actor manage a member with target role?
create or replace function public.can_manage_workspace_member(
  _workspace_id uuid,
  _actor_id uuid,
  _target_role public.user_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_workspace_owner(_workspace_id, _actor_id)
    or (
      public.workspace_actor_role_rank(_workspace_id, _actor_id) >= 2
      and public.workspace_actor_role_rank(_workspace_id, _actor_id) >= public.user_role_rank(_target_role)
    );
$$;

-- Lock down helpers (still executable by authenticated users)
revoke all on function public.is_workspace_owner(uuid, uuid) from public;
revoke all on function public.is_workspace_member(uuid, uuid) from public;
revoke all on function public.workspace_actor_role_rank(uuid, uuid) from public;
revoke all on function public.can_manage_workspace_member(uuid, uuid, public.user_role) from public;

grant execute on function public.is_workspace_owner(uuid, uuid) to authenticated;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.workspace_actor_role_rank(uuid, uuid) to authenticated;
grant execute on function public.can_manage_workspace_member(uuid, uuid, public.user_role) to authenticated;

-- Re-create policies without self-referencing workspace_members

-- Workspaces: member or owner can read
drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member" on public.workspaces
  for select using (
    owner_id = auth.uid()
    or public.is_workspace_member(workspaces.id, auth.uid())
  );

-- Workspace members: any member (or owner) can list members
drop policy if exists "workspace_members_select_in_workspace" on public.workspace_members;
create policy "workspace_members_select_in_workspace" on public.workspace_members
  for select using (
    public.is_workspace_owner(workspace_members.workspace_id, auth.uid())
    or public.is_workspace_member(workspace_members.workspace_id, auth.uid())
  );

-- Managers (doi_pho+) or owner can add members, but not with higher role than themselves.
drop policy if exists "workspace_members_insert_by_manager" on public.workspace_members;
create policy "workspace_members_insert_by_manager" on public.workspace_members
  for insert with check (
    public.can_manage_workspace_member(workspace_members.workspace_id, auth.uid(), workspace_members.role)
  );

-- Update member role: managers/owner, and cannot promote above their own rank.
drop policy if exists "workspace_members_update_by_manager" on public.workspace_members;
create policy "workspace_members_update_by_manager" on public.workspace_members
  for update using (
    public.can_manage_workspace_member(workspace_members.workspace_id, auth.uid(), workspace_members.role)
  )
  with check (
    public.can_manage_workspace_member(workspace_members.workspace_id, auth.uid(), workspace_members.role)
  );

-- Remove members: managers/owner, and cannot remove someone with higher role.
drop policy if exists "workspace_members_delete_by_manager" on public.workspace_members;
create policy "workspace_members_delete_by_manager" on public.workspace_members
  for delete using (
    public.can_manage_workspace_member(workspace_members.workspace_id, auth.uid(), workspace_members.role)
  );


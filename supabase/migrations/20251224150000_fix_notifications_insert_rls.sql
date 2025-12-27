-- Fix: RLS violation when triggers insert into public.notifications
-- Error seen in app: "new row violates row-level security policy for table \"notifications\""
--
-- Cause:
-- - notifications has RLS enabled and does NOT allow INSERT for authenticated users
-- - task/comment/attachment triggers call public.notify_insert() which previously ran as INVOKER
--
-- Solution:
-- - make public.notify_insert() SECURITY DEFINER so it runs with the function owner's privileges
--   (migrations run as postgres/supabase_admin), bypassing RLS safely.
-- - restrict EXECUTE to authenticated/service_role.

create or replace function public.notify_insert(_user_id uuid, _title text, _body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id is null then
    return;
  end if;

  insert into public.notifications(user_id, title, body)
  values (_user_id, _title, _body);
end;
$$;

revoke all on function public.notify_insert(uuid, text, text) from public;
grant execute on function public.notify_insert(uuid, text, text) to authenticated;
grant execute on function public.notify_insert(uuid, text, text) to service_role;


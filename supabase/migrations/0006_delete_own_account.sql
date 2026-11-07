-- Migration: 0006_delete_own_account
-- Lets a signed-in user permanently delete their own account from Settings.
-- Deleting the auth user cascades to profiles -> library entries, reviews, chapter reads, activity.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

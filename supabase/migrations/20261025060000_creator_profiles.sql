-- REVIEW ONLY: do not apply to the linked cloud project without separate approval.
begin;
create table public.creator_profiles (
  account_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z][a-z0-9_]{2,29}$' and handle not in ('blaze','tonemadelt','judgeraye','admin','support','arena')),
  display_name text not null check (char_length(display_name) between 1 and 80 and display_name = btrim(display_name)),
  bio text not null default '' check (char_length(bio) <= 500),
  location text not null default '' check (char_length(location) <= 100),
  creator_role text not null check (creator_role in ('Rapper','Producer','Both','Fan')),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.creator_profiles enable row level security;
-- All columns are public profile fields. Email/auth metadata never enter this table.
revoke all on public.creator_profiles from public, anon, authenticated;
grant select on public.creator_profiles to anon, authenticated;
grant insert (account_id, handle, display_name, bio, location, creator_role) on public.creator_profiles to authenticated;
grant update (display_name, bio, location, creator_role) on public.creator_profiles to authenticated;
-- Read confirmation from Auth's protected table, never client-editable user_metadata.
create function public.arena_verified_account() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = (select auth.uid()) and email_confirmed_at is not null and not coalesce(is_anonymous, false));
$$;
revoke all on function public.arena_verified_account() from public;
grant execute on function public.arena_verified_account() to authenticated;
create policy profiles_public_read on public.creator_profiles for select to anon, authenticated using (true);
create policy profiles_owner_insert on public.creator_profiles for insert to authenticated
  with check ((select auth.uid()) = account_id and (select public.arena_verified_account()));
create policy profiles_owner_update on public.creator_profiles for update to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id and (select public.arena_verified_account()));
-- No delete grant/policy. Account deletion requires a separate trusted lifecycle.
create function public.creator_profile_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.account_id is distinct from old.account_id or new.handle is distinct from old.handle or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity is immutable';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.creator_profile_revision() from public;
create trigger creator_profile_revision before update on public.creator_profiles
  for each row execute function public.creator_profile_revision();
-- Recording information is private. Never add it to the public profile SELECT.
create table public.creator_recording_preferences (
  account_id uuid primary key references public.creator_profiles(account_id) on delete cascade,
  recording_setup text check (recording_setup in ('Home studio','Phone/tablet/computer recording app','External studio or limited access')),
  can_record_15m text check (can_record_15m in ('Yes','Sometimes','No')),
  revision integer not null default 0 check (revision >= 0)
);
alter table public.creator_recording_preferences enable row level security;
revoke all on public.creator_recording_preferences from public, anon, authenticated;
grant select on public.creator_recording_preferences to authenticated;
grant insert (account_id, recording_setup, can_record_15m) on public.creator_recording_preferences to authenticated;
grant update (recording_setup, can_record_15m) on public.creator_recording_preferences to authenticated;
create policy recording_owner_read on public.creator_recording_preferences for select to authenticated using ((select auth.uid()) = account_id);
create policy recording_owner_insert on public.creator_recording_preferences for insert to authenticated
  with check ((select auth.uid()) = account_id and (select public.arena_verified_account()));
create policy recording_owner_update on public.creator_recording_preferences for update to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id and (select public.arena_verified_account()));
create function public.creator_recording_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.account_id is distinct from old.account_id then raise exception 'Recording preference ownership is immutable'; end if;
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke all on function public.creator_recording_revision() from public;
create trigger creator_recording_revision before update on public.creator_recording_preferences
  for each row execute function public.creator_recording_revision();
commit;

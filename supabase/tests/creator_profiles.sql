-- LOCAL DISPOSABLE DATABASE ONLY. Never run this against the linked cloud project.
-- Requires the reviewed migration already applied LOCALLY. All fixtures roll back.
-- psql must fail the process on any SQL/assertion error, rather than report success after ROLLBACK.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, email_confirmed_at, is_anonymous) values
 ('11111111-1111-4111-8111-111111111111','a@local.invalid',now(),false),
 ('22222222-2222-4222-8222-222222222222','b@local.invalid',now(),false),
 ('33333333-3333-4333-8333-333333333333','unverified@local.invalid',null,false),
 ('44444444-4444-4444-8444-444444444444','anonymous@local.invalid',now(),true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
insert into public.creator_profiles (account_id,handle,display_name,creator_role)
 values ('11111111-1111-4111-8111-111111111111','local_account_a','Account A','Both');
-- Optional private preferences can be cleared and versioned without changing roles.
insert into public.creator_recording_preferences (account_id,recording_setup,can_record_15m)
 values ('11111111-1111-4111-8111-111111111111','Home studio','No');
update public.creator_recording_preferences set recording_setup = null, can_record_15m = null
 where account_id = '11111111-1111-4111-8111-111111111111' and revision = 0;
do $$ begin
  if not exists(select 1 from public.creator_recording_preferences where revision = 1 and recording_setup is null and can_record_15m is null) then raise exception 'FAIL: optional preference clearing/version'; end if;
  update public.creator_recording_preferences set can_record_15m = 'Yes' where revision = 0;
  if found then raise exception 'FAIL: stale preference revision accepted'; end if;
  begin
    update public.creator_recording_preferences set can_record_15m = 'Always';
    raise exception 'FAIL: invalid recording preference accepted';
  exception when check_violation then null; end;
  begin
    update public.creator_recording_preferences set account_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: preference owner writable';
  exception when insufficient_privilege then null; end;
end $$;
-- Malicious owner reassignment at insert is blocked by RLS.
do $$ begin
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role)
      values ('22222222-2222-4222-8222-222222222222','stolen','Stolen','Producer');
    raise exception 'FAIL: forged owner accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.creator_profiles set account_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: account identity writable';
  exception when insufficient_privilege then null; end;
  begin
    update public.creator_profiles set handle = 'renamed';
    raise exception 'FAIL: handle writable';
  exception when insufficient_privilege then null; end;
  begin
    update public.creator_profiles set creator_role = 'Admin';
    raise exception 'FAIL: invalid role accepted';
  exception when check_violation then null; end;
  begin
    delete from public.creator_profiles;
    raise exception 'FAIL: delete permitted';
  exception when insufficient_privilege then null; end;
end $$;
update public.creator_profiles set creator_role = 'Rapper' where account_id = '11111111-1111-4111-8111-111111111111' and revision = 0;
do $$ begin
  if not exists (select 1 from public.creator_profiles where handle = 'local_account_a' and revision = 1 and creator_role = 'Rapper') then raise exception 'FAIL: owner update/revision'; end if;
  update public.creator_profiles set creator_role = 'Producer' where account_id = '11111111-1111-4111-8111-111111111111' and revision = 0;
  if found then raise exception 'FAIL: stale revision updated'; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.creator_recording_preferences) then raise exception 'FAIL: private preferences leaked to visitor'; end if;
  update public.creator_recording_preferences set can_record_15m = 'Yes' where account_id = '11111111-1111-4111-8111-111111111111';
  if found then raise exception 'FAIL: visitor updated preferences'; end if;
  begin
    insert into public.creator_recording_preferences (account_id,recording_setup) values ('11111111-1111-4111-8111-111111111111','Home studio');
    raise exception 'FAIL: visitor inserted preferences for another account';
  exception when insufficient_privilege then null; end;
  update public.creator_profiles set display_name = 'Hacked' where handle = 'local_account_a';
  if found then raise exception 'FAIL: visitor updated another profile'; end if;
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role)
      values ('22222222-2222-4222-8222-222222222222','local_account_a','Account B','Producer');
    raise exception 'FAIL: duplicate handle accepted';
  exception when unique_violation then null; end;
end $$;
insert into public.creator_profiles (account_id,handle,display_name,creator_role)
 values ('22222222-2222-4222-8222-222222222222','local_account_b','Account B','Fan');
-- A Fan can edit their public profile and change role without music/setup prerequisites.
update public.creator_profiles set display_name = 'Updated Fan', creator_role = 'Producer'
 where account_id = '22222222-2222-4222-8222-222222222222' and revision = 0;
do $$ begin
  if not exists(select 1 from public.creator_profiles where handle = 'local_account_b' and creator_role = 'Producer' and display_name = 'Updated Fan' and revision = 1) then raise exception 'FAIL: Fan owner edit/role change'; end if;
end $$;
update public.creator_profiles set creator_role = 'Fan'
 where account_id = '22222222-2222-4222-8222-222222222222' and revision = 1;
do $$ begin
  if not exists(select 1 from public.creator_profiles where handle = 'local_account_b' and creator_role = 'Fan' and revision = 2) then raise exception 'FAIL: restoring Fan role'; end if;
  if exists(select 1 from public.creator_recording_preferences) then raise exception 'FAIL: Fan unexpectedly requires recording setup'; end if;
end $$;

-- An unverified account cannot forge verification in JWT/user metadata.
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","user_metadata":{"email_verified":true}}',true);
do $$ begin
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role)
      values ('33333333-3333-4333-8333-333333333333','unverified','Unverified','Rapper');
    raise exception 'FAIL: unverified account accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
do $$ begin
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role)
      values ('44444444-4444-4444-8444-444444444444','anonymous','Anonymous','Rapper');
    raise exception 'FAIL: anonymous account accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  begin
    perform * from public.creator_recording_preferences;
    raise exception 'FAIL: anonymous private preferences readable';
  exception when insufficient_privilege then null; end;
  begin
    update public.creator_profiles set display_name = 'Anonymous edit' where handle = 'local_account_a';
    raise exception 'FAIL: anonymous profile update permitted';
  exception when insufficient_privilege then null; end;
  begin
    update public.creator_recording_preferences set can_record_15m = 'Yes';
    raise exception 'FAIL: anonymous preference update permitted';
  exception when insufficient_privilege then null; end;
  if not exists(select 1 from public.creator_profiles where handle = 'local_account_b' and creator_role = 'Fan') then raise exception 'FAIL: public Fan profile without music/setup'; end if;
  if (select count(*) from public.creator_profiles where handle in ('local_account_a','local_account_b')) <> 2 then raise exception 'FAIL: public role display inaccessible'; end if;
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role)
      values ('33333333-3333-4333-8333-333333333333','anonymous','Anonymous','Rapper');
    raise exception 'FAIL: unauthenticated insert permitted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

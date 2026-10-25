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
\echo PASS: Optional private preferences: owner save, clear, revision, stale update, invalid value and immutable owner
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
\echo PASS: Profile ownership: forged owner, immutable ID/handle grants, invalid role and delete denial
update public.creator_profiles set creator_role = 'Rapper' where account_id = '11111111-1111-4111-8111-111111111111' and revision = 0;
do $$ begin
  if not exists (select 1 from public.creator_profiles where handle = 'local_account_a' and revision = 1 and creator_role = 'Rapper') then raise exception 'FAIL: owner update/revision'; end if;
  update public.creator_profiles set creator_role = 'Producer' where account_id = '11111111-1111-4111-8111-111111111111' and revision = 0;
  if found then raise exception 'FAIL: stale revision updated'; end if;
end $$;
\echo PASS: Owner profile update: Rapper role, revision increment and stale update

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
\echo PASS: Cross-account profile/preferences isolation and unique handle enforcement
insert into public.creator_profiles (account_id,handle,display_name,creator_role)
 values ('22222222-2222-4222-8222-222222222222','local_account_b','Account B','Fan');
-- A Fan can edit their public profile and change role without music/setup prerequisites.
update public.creator_profiles set display_name = 'Updated Fan', creator_role = 'Producer'
 where account_id = '22222222-2222-4222-8222-222222222222' and revision = 0;
do $$ begin
  if not exists(select 1 from public.creator_profiles where handle = 'local_account_b' and creator_role = 'Producer' and display_name = 'Updated Fan' and revision = 1) then raise exception 'FAIL: Fan owner edit/role change'; end if;
end $$;
\echo PASS: Fan owner editing and Producer role change
update public.creator_profiles set creator_role = 'Fan'
 where account_id = '22222222-2222-4222-8222-222222222222' and revision = 1;
do $$ begin
  if not exists(select 1 from public.creator_profiles where handle = 'local_account_b' and creator_role = 'Fan' and revision = 2) then raise exception 'FAIL: restoring Fan role'; end if;
  if exists(select 1 from public.creator_recording_preferences) then raise exception 'FAIL: Fan unexpectedly requires recording setup'; end if;
end $$;
\echo PASS: Fan role restoration without recording setup

-- An unverified account cannot forge verification in JWT/user metadata.
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","user_metadata":{"email_verified":true}}',true);
do $$ begin
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role)
      values ('33333333-3333-4333-8333-333333333333','unverified','Unverified','Rapper');
    raise exception 'FAIL: unverified account accepted';
  exception when insufficient_privilege then null; end;
end $$;
\echo PASS: Unverified account rejected despite forged verification metadata
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
do $$ begin
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role)
      values ('44444444-4444-4444-8444-444444444444','anonymous','Anonymous','Rapper');
    raise exception 'FAIL: anonymous account accepted';
  exception when insufficient_privilege then null; end;
end $$;
\echo PASS: Anonymous Auth account rejected
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
\echo PASS: Anonymous public profiles and denied profile/preference reads or mutations as appropriate
reset role;
-- These privileged fixture checks test database constraints/triggers independently of RLS.
do $$ begin
  if has_table_privilege('anon','public.creator_profiles','INSERT,UPDATE,DELETE') then raise exception 'FAIL: anonymous profile mutation grant'; end if;
  if has_table_privilege('anon','public.creator_recording_preferences','SELECT,INSERT,UPDATE,DELETE') then raise exception 'FAIL: anonymous private preference grant'; end if;
  if has_column_privilege('authenticated','public.creator_profiles','account_id','UPDATE') or has_column_privilege('authenticated','public.creator_profiles','handle','UPDATE') or has_column_privilege('authenticated','public.creator_profiles','revision','UPDATE') or has_column_privilege('authenticated','public.creator_profiles','created_at','UPDATE') then raise exception 'FAIL: protected profile column grant'; end if;
  if has_column_privilege('authenticated','public.creator_recording_preferences','account_id','UPDATE') or has_column_privilege('authenticated','public.creator_recording_preferences','revision','UPDATE') then raise exception 'FAIL: protected preference column grant'; end if;
  if not has_column_privilege('authenticated','public.creator_profiles','creator_role','UPDATE') or not has_column_privilege('authenticated','public.creator_recording_preferences','recording_setup','UPDATE') then raise exception 'FAIL: intended owner column grants missing'; end if;
  if has_function_privilege('anon','public.arena_verified_account()','EXECUTE') then raise exception 'FAIL: anonymous verification-helper execution grant'; end if;
end $$;
\echo PASS: Explicit table, column and verification-helper grants

do $$ begin
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role) values ('55555555-5555-4555-8555-555555555555','missing_auth','Missing','Fan');
    raise exception 'FAIL: profile without Auth user';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.creator_recording_preferences (account_id) values ('33333333-3333-4333-8333-333333333333');
    raise exception 'FAIL: preferences without profile';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role) values ('11111111-1111-4111-8111-111111111111','another_handle','Duplicate','Fan');
    raise exception 'FAIL: duplicate account profile';
  exception when unique_violation then null; end;
  begin
    update public.creator_profiles set bio = repeat('x',501) where handle = 'local_account_a';
    raise exception 'FAIL: oversized public bio';
  exception when check_violation then null; end;
  begin
    insert into public.creator_profiles (account_id,handle,display_name,creator_role) values ('33333333-3333-4333-8333-333333333333','Bad-Handle','Bad','Fan');
    raise exception 'FAIL: malformed handle';
  exception when check_violation then null; end;
end $$;
\echo PASS: Both foreign keys, unique account and malformed/oversized data constraints

do $$ begin
  begin
    update public.creator_profiles set handle = 'admin_renamed' where handle = 'local_account_a';
    raise exception 'FAIL: immutable handle trigger';
  exception when raise_exception then if sqlerrm <> 'Profile identity is immutable' then raise; end if; end;
  begin
    update public.creator_profiles set account_id = '33333333-3333-4333-8333-333333333333' where handle = 'local_account_a';
    raise exception 'FAIL: immutable profile owner trigger';
  exception when raise_exception then if sqlerrm <> 'Profile identity is immutable' then raise; end if; end;
  begin
    update public.creator_profiles set created_at = '2000-01-01' where handle = 'local_account_a';
    raise exception 'FAIL: immutable creation timestamp trigger';
  exception when raise_exception then if sqlerrm <> 'Profile identity is immutable' then raise; end if; end;
  begin
    update public.creator_recording_preferences set account_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: immutable preference owner trigger';
  exception when raise_exception then if sqlerrm <> 'Recording preference ownership is immutable' then raise; end if; end;
  update public.creator_profiles set revision = 999, updated_at = '2000-01-01' where handle = 'local_account_a';
  if not exists(select 1 from public.creator_profiles where handle = 'local_account_a' and revision = 2 and updated_at = transaction_timestamp()) then raise exception 'FAIL: profile server-controlled revision/timestamp'; end if;
  update public.creator_recording_preferences set revision = 999;
  if not exists(select 1 from public.creator_recording_preferences where account_id = '11111111-1111-4111-8111-111111111111' and revision = 2) then raise exception 'FAIL: preference server-controlled revision'; end if;
end $$;
\echo PASS: Immutable identity/creation triggers and server-controlled revisions/timestamp
rollback;
do $$ begin
  if exists(select 1 from auth.users where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')) then raise exception 'FAIL: fixture rollback'; end if;
  if exists(select 1 from public.creator_profiles) or exists(select 1 from public.creator_recording_preferences) then raise exception 'FAIL: profile/preference fixture rollback'; end if;
end $$;
\echo PASS: All fixture users/profiles/preferences rolled back
\echo ALL DATABASE ASSERTIONS PASSED

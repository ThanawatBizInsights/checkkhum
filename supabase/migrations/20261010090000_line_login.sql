-- LINE Login / LIFF for customers.
--
-- A LINE user is identified by the `sub` of a LINE ID token that the website
-- server has verified with LINE (POST https://api.line.me/oauth2/v2.1/verify).
-- The server then signs the visitor in to ONE Supabase Auth login:
--   * the login already mapped to that LINE user id, or
--   * a new customer login created for that LINE user, or
--   * (explicit "เชื่อมบัญชี LINE" while signed in) the visitor's current login.
-- The mapping is one-to-one (unique on both sides) and written only by the
-- server (service role) through link_line_account(). Staff logins are never
-- mapped, so LINE can never open the CRM.
--
-- LINE users often have no email, so staff can also invite a CRM customer with
-- a single-use link sent in the LINE chat (customer_invitations.token_hash).
-- Opening it while signed in links that login to that customer, exactly like
-- an accepted email invitation. Nothing is ever linked from a LINE display
-- name, email or phone number.

-- ---------------------------------------------------------------------------
-- LINE accounts
-- ---------------------------------------------------------------------------
create table public.customer_line_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users (id) on delete cascade,
  line_user_id   text not null unique check (line_user_id ~ '^U[0-9a-f]{32}$'),
  display_name   text check (char_length(display_name) <= 100),
  picture_url    text check (picture_url is null or (picture_url ~ '^https://' and char_length(picture_url) <= 500)),
  linked_at      timestamptz not null default now(),
  last_login_at  timestamptz,
  updated_at     timestamptz not null default now()
);
comment on table public.customer_line_accounts is
  'One LINE user id per customer login, from a LINE ID token verified on the server. Written only by link_line_account().';

create trigger set_updated_at before update on public.customer_line_accounts
  for each row execute function private.set_updated_at();

alter table public.customer_line_accounts enable row level security;
revoke all on table public.customer_line_accounts from public, anon, authenticated;
revoke truncate on table public.customer_line_accounts from service_role;
create trigger write_audit_log after insert or update or delete on public.customer_line_accounts
  for each row execute function private.write_audit_log();

grant select on public.customer_line_accounts to authenticated;
grant delete on public.customer_line_accounts to authenticated;

create policy "Customers view their own LINE link" on public.customer_line_accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Staff view LINE links" on public.customer_line_accounts
  for select to authenticated using ((select private.is_staff()));
create policy "Admins remove LINE links" on public.customer_line_accounts
  for delete to authenticated using ((select private.is_admin()));

-- A LINE-mapped login can never become staff (and staff are never mapped).
create or replace function private.refuse_staff_with_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.customer_line_accounts l where l.user_id = new.id) then
    raise exception 'บัญชีนี้เชื่อมกับ LINE ของลูกค้า ใช้เป็นบัญชีพนักงานไม่ได้' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.refuse_staff_with_line() from public, anon, authenticated;
create trigger refuse_staff_with_line
  before insert or update of id on public.staff_users
  for each row execute function private.refuse_staff_with_line();

-- ---------------------------------------------------------------------------
-- Server-only functions (secret key; anon and authenticated can't call them)
-- ---------------------------------------------------------------------------

-- The login mapped to a verified LINE user id, or NULL. Never a staff login.
create or replace function public.line_login_user(p_line_user_id text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select l.user_id
    from public.customer_line_accounts l
   where l.line_user_id = p_line_user_id
     and not exists (select 1 from public.staff_users s where s.id = l.user_id)
$$;

-- Map a verified LINE user id to a login, or refresh the existing mapping.
-- Returns: linked | already | line_taken | user_has_other_line | staff | no_user
create or replace function public.link_line_account(
  p_user uuid,
  p_line_user_id text,
  p_display_name text default null,
  p_picture_url text default null
)
returns text
language plpgsql
volatile
security definer -- reads auth.users; still executable only by service_role
set search_path = ''
as $$
declare
  v_existing public.customer_line_accounts;
  v_name text := nullif(btrim(left(p_display_name, 100)), '');
  v_picture text := case when p_picture_url ~ '^https://' and char_length(p_picture_url) <= 500 then p_picture_url end;
begin
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
    return 'no_user';
  end if;
  if exists (select 1 from public.staff_users s where s.id = p_user) then
    return 'staff';
  end if;

  -- Serialise per LINE user id so two taps can't create two mappings.
  perform pg_advisory_xact_lock(hashtextextended('line:' || p_line_user_id, 0));

  select * into v_existing from public.customer_line_accounts l where l.line_user_id = p_line_user_id;
  if found then
    if v_existing.user_id <> p_user then
      return 'line_taken';
    end if;
    update public.customer_line_accounts
       set display_name = coalesce(v_name, display_name),
           picture_url = v_picture,
           last_login_at = now()
     where id = v_existing.id;
    return 'already';
  end if;

  if exists (select 1 from public.customer_line_accounts l where l.user_id = p_user) then
    return 'user_has_other_line';
  end if;

  insert into public.customer_line_accounts (user_id, line_user_id, display_name, picture_url, last_login_at)
  values (p_user, p_line_user_id, v_name, v_picture, now());
  -- Auth writes app_metadata after the user row, so the profile trigger can't
  -- see the LINE marker yet: label logins created by LINE Login here.
  update public.customer_profiles p
     set source = 'line'
    from auth.users u
   where p.user_id = p_user and u.id = p_user and p.source = 'other'
     and coalesce(u.raw_app_meta_data ->> 'checkkhum_line', '') = 'true';
  return 'linked';
end;
$$;

revoke all on function public.line_login_user(text), public.link_line_account(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.line_login_user(text), public.link_line_account(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Profiles: mark logins created for LINE
-- ---------------------------------------------------------------------------
alter table public.customer_profiles drop constraint customer_profiles_source_check;
alter table public.customer_profiles
  add constraint customer_profiles_source_check check (source in ('self_registration', 'invitation', 'line', 'other'));

-- Same as before, plus: app_metadata.checkkhum_line (set by the server, not
-- editable by users) marks a login created by LINE Login.
create or replace function private.profile_values(u auth.users)
returns public.customer_profiles
language plpgsql
stable
set search_path = ''
as $$
declare
  r public.customer_profiles;
begin
  r.user_id := u.id;
  r.email := lower(coalesce(u.email, ''));
  r.full_name := coalesce(
    nullif(btrim(left(u.raw_user_meta_data ->> 'full_name', 120)), ''),
    nullif(left(split_part(coalesce(u.email, ''), '@', 1), 120), ''),
    'ลูกค้า'
  );
  r.source := case
    when coalesce(u.raw_app_meta_data ->> 'checkkhum_line', '') = 'true' then 'line'
    when u.invited_at is not null then 'invitation'
    when u.raw_user_meta_data ? 'privacy_notice_version' then 'self_registration'
    else 'other'
  end;
  r.privacy_notice_version := nullif(left(u.raw_user_meta_data ->> 'privacy_notice_version', 40), '');
  r.privacy_acknowledged_at := case when r.privacy_notice_version is not null then u.created_at end;
  return r;
end;
$$;
revoke all on function private.profile_values(auth.users) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Invitation links for the LINE chat (no email needed)
-- ---------------------------------------------------------------------------
alter table public.customer_invitations alter column email drop not null;
alter table public.customer_invitations add column token_hash text unique check (token_hash ~ '^[0-9a-f]{64}$');
alter table public.customer_invitations
  add constraint customer_invitations_target check (email is not null or token_hash is not null);

-- Staff (agents, admins) create a link for one customer. SECURITY INVOKER: the
-- existing RLS policies decide who may. Returns the token once; only its
-- SHA-256 is stored. Replaces the customer's open invitation, if any.
create or replace function public.create_line_invitation(p_customer_id uuid)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not private.can_write() then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้' using errcode = '42501';
  end if;
  if exists (select 1 from public.customer_accounts a where a.customer_id = p_customer_id) then
    raise exception 'ลูกค้ารายนี้มีบัญชีที่เชื่อมแล้ว' using errcode = 'P0001';
  end if;
  update public.customer_invitations
     set revoked_at = now()
   where customer_id = p_customer_id and accepted_at is null and revoked_at is null;
  insert into public.customer_invitations (customer_id, token_hash)
  values (p_customer_id, encode(extensions.digest(v_token, 'sha256'), 'hex'));
  return v_token;
end;
$$;
revoke all on function public.create_line_invitation(uuid) from public, anon;
grant execute on function public.create_line_invitation(uuid) to authenticated;

-- The signed-in customer accepts a link invitation.
-- Returns: linked | already_linked | invalid | customer_taken | staff | signed_out
create or replace function public.accept_invitation_token(p_token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.customer_invitations;
begin
  if v_uid is null then
    return 'signed_out';
  end if;
  if exists (select 1 from public.staff_users s where s.id = v_uid) then
    return 'staff';
  end if;
  if exists (select 1 from public.customer_accounts a where a.user_id = v_uid) then
    return 'already_linked';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return 'invalid';
  end if;

  select * into v_inv
    from public.customer_invitations i
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and i.accepted_at is null
     and i.revoked_at is null
     and i.expires_at > now()
   for update;
  if not found then
    return 'invalid';
  end if;

  if exists (select 1 from public.customer_accounts a where a.customer_id = v_inv.customer_id) then
    update public.customer_invitations set revoked_at = now() where id = v_inv.id;
    return 'customer_taken';
  end if;

  insert into public.customer_accounts (user_id, customer_id, invitation_id)
  values (v_uid, v_inv.customer_id, v_inv.id);
  update public.customer_invitations
     set accepted_at = now(), accepted_user_id = v_uid
   where id = v_inv.id;
  perform private.ensure_customer_profile();
  return 'linked';
end;
$$;
revoke all on function public.accept_invitation_token(text) from public, anon;
grant execute on function public.accept_invitation_token(text) to authenticated;

-- LINE OA conversation link for the staff CRM.
--
-- Staff chat with customers in LINE Official Account Manager
-- (https://chat.line.biz/<account>/chat/<user>). That URL is not a personal
-- LINE profile link, so it does not fit customers.line_url (line.me / lin.ee
-- only, 20261012090000_customer_line_contact.sql). It gets its own column.
--
-- - Additive only: no existing column, value or enquiry snapshot changes.
-- - Staff-only: written by agents and admins through the existing customers
--   RLS policies; audited by the existing write_audit_log trigger (it stores
--   whole rows). Not read or written by submit_enquiry, portal_overview or
--   any public route.
-- - It says nothing about who the customer is on LINE. It does not touch
--   line_contact_source (the typed, unverified details) or
--   customer_line_accounts (the only verified LINE identity). Opening it needs
--   a LINE OA sign-in with permission to see that chat.

-- https, exactly the host chat.line.biz, no userinfo, no port, then a
-- non-empty path; no spaces, quotes, backslashes or angle brackets; at most
-- 500 characters. Mirrors isLineOaChatUrl() in src/lib/line-contact.ts, which
-- also parses the URL and requires it to be in canonical form.
create or replace function private.is_line_oa_chat_url(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(p_url) <= 500
     and p_url ~ '^https://chat\.line\.biz/[A-Za-z0-9._~%!$&()*+,;=:@/?#-]+$';
$$;
revoke all on function private.is_line_oa_chat_url(text) from public, anon;
grant execute on function private.is_line_oa_chat_url(text) to authenticated, service_role;

alter table public.customers
  add column line_oa_chat_url text
    check (line_oa_chat_url is null or private.is_line_oa_chat_url(line_oa_chat_url));

comment on column public.customers.line_oa_chat_url is
  'LINE OA Manager conversation URL (https://chat.line.biz/...), pasted by staff. Staff only; opening it needs a LINE OA sign-in. Not a verified LINE identity.';

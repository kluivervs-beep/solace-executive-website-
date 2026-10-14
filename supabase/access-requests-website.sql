-- Website applicants land in access_requests too, so staff approve them
-- from the dashboard/team app like app applicants. The website form keeps
-- posting to Formspree (full answers by mail), so rows with source =
-- 'website' must not trigger a second, thinner Formspree mail.
alter table public.access_requests add column if not exists source text;
alter table public.access_requests add column if not exists intake jsonb;
alter table public.access_requests drop constraint if exists access_requests_intake_size;
alter table public.access_requests add constraint access_requests_intake_size
  check (intake is null or octet_length(intake::text) < 8000);

create or replace function public.notify_access_request()
returns trigger
language plpgsql security definer set search_path = public, net
as $$
declare
  admin_row record;
begin
  if coalesce(new.source, '') <> 'website' then
    perform net.http_post(
      url := 'https://formspree.io/f/xgojjlzv',
      body := jsonb_build_object(
        '_subject', 'Nieuwe toegangsaanvraag: ' || new.full_name,
        'name', new.full_name,
        'email', new.email,
        'message', 'Telefoon: ' || coalesce(new.phone, '-') || E'\nUitnodigingscode: ' || coalesce(new.referral_code, '-')
      ),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end if;
  for admin_row in select push_token from public.profiles where is_admin and push_token is not null loop
    perform net.http_post(
      url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
        'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr'
      ),
      body := jsonb_build_object(
        'push_token', admin_row.push_token,
        'title', 'Nieuwe toegangsaanvraag',
        'body', new.full_name || ' vraagt toegang aan',
        'data', jsonb_build_object('type', 'access_request')
      )
    );
  end loop;
  return new;
end;
$$;

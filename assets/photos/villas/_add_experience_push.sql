-- Run in the Supabase SQL Editor. Adds a push notification to every
-- member (not staff) when staff adds a new experience, mirroring the
-- existing access-request push notification pattern.

create or replace function public.notify_new_experience()
returns trigger as $$
declare
  member_row record;
begin
  for member_row in select push_token from public.profiles where not coalesce(is_admin, false) and push_token is not null loop
    perform net.http_post(
      url := 'https://weiihajterqholxppgsl.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr',
        'Authorization', 'Bearer sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr'
      ),
      body := jsonb_build_object(
        'push_token', member_row.push_token,
        'title', 'Nieuwe experience',
        'body', new.title,
        'data', jsonb_build_object('type', 'new_experience', 'id', new.id)
      )
    );
  end loop;

  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

drop trigger if exists notify_new_experience_trigger on public.member_experiences;
create trigger notify_new_experience_trigger
  after insert on public.member_experiences
  for each row execute function public.notify_new_experience();

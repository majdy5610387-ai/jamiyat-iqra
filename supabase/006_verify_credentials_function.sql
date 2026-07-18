-- دالة التحقق من بيانات دخول المحفظ/ولي الأمر.
-- تُستدعى حصرًا من Edge Function باسم custom-login عبر service role.
-- ممنوعة تمامًا على anon و authenticated (لا يمكن استدعاؤها مباشرة من المتصفح
-- حتى لو امتلك أحدهم مفتاح anon).

create or replace function verify_credentials(
  p_national_id text,
  p_password text,
  p_role text
)
returns table (user_id uuid, is_valid boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user app_users%rowtype;
  v_max_attempts constant int := 5;
  v_lockout_duration constant interval := '15 minutes';
begin
  select * into v_user
  from app_users
  where national_id = p_national_id and role = p_role;

  if not found then
    -- رسالة عامة لا تكشف ما إذا كان الحساب موجودًا أصلًا (منع تعداد الحسابات)
    return query select null::uuid, false, 'بيانات الدخول غير صحيحة';
    return;
  end if;

  if v_user.locked_until is not null and v_user.locked_until > now() then
    return query select null::uuid, false, 'الحساب مقفل مؤقتًا بسبب محاولات فاشلة متكررة، حاول لاحقًا';
    return;
  end if;

  if v_user.password_hash = crypt(p_password, v_user.password_hash) then
    update app_users
    set failed_attempts = 0, locked_until = null
    where id = v_user.id;

    return query select v_user.id, true, 'ok';
  else
    update app_users
    set
      failed_attempts = v_user.failed_attempts + 1,
      locked_until = case
        when v_user.failed_attempts + 1 >= v_max_attempts
          then now() + v_lockout_duration
        else null
      end
    where id = v_user.id;

    return query select null::uuid, false, 'بيانات الدخول غير صحيحة';
  end if;
end;
$$;

revoke all on function verify_credentials(text, text, text) from public, anon, authenticated;
grant execute on function verify_credentials(text, text, text) to service_role;

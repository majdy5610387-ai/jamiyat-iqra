-- تُستخدم حصرًا لتصدير النسخة الاحتياطية. SECURITY DEFINER عمدًا: تتجاوز
-- تقييد العمود الحالي (revoke select على password_hash من authenticated
-- بملف 004) لأن الاستعادة تتطلب حفظ كلمات المرور المشفّرة كما هي — لكن
-- التحقق الصريح من is_super_admin() بالداخل يمنع أي استخدام آخر غير مصرَّح
-- به، فلا يُضعف هذا التقييد العام للتطبيق.

create or replace function export_app_users_for_backup()
returns table (
  id uuid,
  role text,
  national_id text,
  password_hash text,
  failed_attempts int,
  locked_until timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'يتطلب صلاحية سوبر أدمن';
  end if;

  return query
  select au.id, au.role, au.national_id, au.password_hash, au.failed_attempts, au.locked_until, au.created_at
  from app_users au;
end;
$$;

revoke all on function export_app_users_for_backup() from public, anon;
grant execute on function export_app_users_for_backup() to authenticated;

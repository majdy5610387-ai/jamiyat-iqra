-- تُستدعى من لوحة المدير (سوبر أدمن فقط، عبر RLS) لإعادة تعيين كلمة مرور
-- محفظ. لا توجد "مشاهدة" لكلمة المرور القديمة إطلاقًا (مستحيل تقنيًا مع
-- bcrypt) — فقط تعيين جديدة.
--
-- SECURITY INVOKER (الافتراضي) — تعتمد كليًا على سياسة "super admins full
-- access on app_users" الحالية (RLS تعمل على مستوى الصف كاملًا، فلا حاجة
-- لسياسة جديدة خاصة بعمود password_hash).
--
-- نُصفّر failed_attempts وlocked_until أيضًا: لو كان الحساب مقفلًا بسبب
-- محاولات دخول فاشلة، يجب أن تُعيد كلمة المرور الجديدة فتح القفل، وإلا بقي
-- المحفظ محظورًا رغم صحة كلمة المرور الجديدة.

create or replace function reset_teacher_password(
  p_teacher_id uuid,
  p_new_password text
)
returns void
language plpgsql
set search_path = public, extensions
as $$
begin
  update app_users
  set
    password_hash = crypt(p_new_password, gen_salt('bf', 10)),
    failed_attempts = 0,
    locked_until = null
  where id = p_teacher_id and role = 'teacher';
end;
$$;

grant execute on function reset_teacher_password(uuid, text) to authenticated;

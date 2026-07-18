-- نسخة تشخيصية مؤقتة من create_student_with_parent: تتوقف عمدًا قبل إدراج
-- app_users وتطبع القيم الحقيقية لسياق الجلسة في تلك اللحظة بالضبط (كرسالة
-- خطأ ترجع للواجهة). لا تُبقِ هذا التعديل بعد التشخيص — سنعيد النسخة
-- الطبيعية (009) فور معرفة السبب.

create or replace function create_student_with_parent(
  p_student_id uuid,
  p_national_id text,
  p_first_name text,
  p_father_name text,
  p_grandfather_name text,
  p_family_name text,
  p_birth_date date,
  p_phone text,
  p_center_id uuid,
  p_teacher_id uuid
)
returns table (student_id uuid, parent_id uuid)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_parent_user_id uuid;
begin
  insert into students (
    id, national_id, first_name, father_name, grandfather_name,
    family_name, birth_date, phone, center_id, teacher_id
  )
  values (
    p_student_id, p_national_id, p_first_name, p_father_name, p_grandfather_name,
    p_family_name, p_birth_date, p_phone, p_center_id, p_teacher_id
  );

  -- توقف تشخيصي مؤقت: يطبع القيم الحقيقية قبل محاولة إدراج app_users مباشرة
  raise exception 'DEBUG uid=% center=% role_setting=% jwt_claims=%',
    auth.uid(),
    get_my_center_id(),
    current_setting('role', true),
    current_setting('request.jwt.claims', true);

  insert into app_users (role, national_id, password_hash)
  values ('parent', p_national_id, crypt(p_national_id, gen_salt('bf', 10)))
  returning id into v_parent_user_id;

  insert into parents (id, student_id, national_id)
  values (v_parent_user_id, p_student_id, p_national_id);

  return query select p_student_id, v_parent_user_id;
end;
$$;

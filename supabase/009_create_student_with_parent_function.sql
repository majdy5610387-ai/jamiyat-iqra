-- تُستدعى من لوحة المحفظ عند إضافة طالب جديد. تُنشئ صف students وحساب ولي
-- الأمر (app_users) وصف parents الرابط بينهما — كلها في معاملة واحدة ذرية،
-- بحيث لا يمكن أن يُحفظ طالب بدون حساب ولي أمر أو العكس.
--
-- p_student_id يُولَّد على جهاز المحفظ نفسه (crypto.randomUUID()) وليس هنا،
-- ليعمل لاحقًا مع التخزين المحلي/المزامنة عند تفعيل وضع العمل بلا إنترنت.
--
-- SECURITY INVOKER (الافتراضي، بدون "security definer") عن قصد — تعمل
-- بصلاحيات المحفظ المستدعي نفسه، فتُطبَّق سياسات RLS الحالية بالكامل على كل
-- إدراج بداخلها دون أي حاجة لتكرار هذه الفحوصات هنا.
--
-- ملاحظة مهمة: نولّد id حساب ولي الأمر يدويًا (gen_random_uuid()) بدل
-- الاعتماد على "returning id into ..." — لأن RETURNING يتطلب صلاحية SELECT
-- على الصف المُدرَج، والمحفظ لا يملك (ولا يجب أن يملك) صلاحية قراءة عامة
-- على app_users، فقط صلاحية الإدراج. تجنّب RETURNING هنا يتفادى هذا القيد
-- تمامًا دون الحاجة لمنح أي صلاحية إضافية.

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
  v_parent_user_id uuid := gen_random_uuid();
begin
  insert into students (
    id, national_id, first_name, father_name, grandfather_name,
    family_name, birth_date, phone, center_id, teacher_id
  )
  values (
    p_student_id, p_national_id, p_first_name, p_father_name, p_grandfather_name,
    p_family_name, p_birth_date, p_phone, p_center_id, p_teacher_id
  );

  insert into app_users (id, role, national_id, password_hash)
  values (v_parent_user_id, 'parent', p_national_id, crypt(p_national_id, gen_salt('bf', 10)));

  insert into parents (id, student_id, national_id)
  values (v_parent_user_id, p_student_id, p_national_id);

  return query select p_student_id, v_parent_user_id;
end;
$$;

grant execute on function create_student_with_parent(
  uuid, text, text, text, text, text, date, text, uuid, uuid
) to authenticated;

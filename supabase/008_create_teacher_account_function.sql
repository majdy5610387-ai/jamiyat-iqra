-- تُستدعى من لوحة المدير عند إضافة محفظ جديد. تُنشئ صف app_users (بكلمة مرور
-- مشفّرة عبر pgcrypto) وصف teachers في عملية واحدة (نفس المعاملة/transaction).
--
-- ملاحظة أمنية مهمة: هذه دالة SECURITY INVOKER (الافتراضي، لا يوجد "security
-- definer") عن قصد — تعمل بصلاحيات المستخدم المستدعي نفسه، فتطبَّق عليها
-- سياسات RLS الحالية لجدولي app_users وteachers كما هي: فقط من يحقق
-- is_manager() يستطيع إتمام الإدراج بنجاح. لا حاجة لتكرار فحص الصلاحية هنا.
--
-- نولّد id حساب المحفظ يدويًا (gen_random_uuid()) بدل "returning id into ..."
-- لتفادي الاعتماد على صلاحية SELECT على app_users (غير ضرورية للمدير هنا
-- أصلًا لأنه يملكها، لكن هذا يجعل النمط متسقًا وأكثر متانة مع
-- create_student_with_parent التي تحتاج هذا التفادي فعليًا).

create or replace function create_teacher_account(
  p_national_id text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_center_id uuid
)
returns table (teacher_id uuid)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into app_users (id, role, national_id, password_hash)
  values (v_user_id, 'teacher', p_national_id, crypt(p_password, gen_salt('bf', 10)));

  insert into teachers (id, full_name, national_id, phone, center_id)
  values (v_user_id, p_full_name, p_national_id, p_phone, p_center_id);

  return query select v_user_id;
end;
$$;

grant execute on function create_teacher_account(text, text, text, text, uuid) to authenticated;

-- تُستدعى من لوحة المدير (سوبر أدمن فقط، عبر RLS) لحذف محفظ.
--
-- نحذف صف app_users فقط — هذا يكفي وحده، لأن teachers.id يشير لـ
-- app_users.id بـ "on delete cascade"، فيُحذف صف teachers تلقائيًا معه.
-- إن كان لهذا المحفظ طلاب مسجّلون، فإن قيد "students.teacher_id ...
-- on delete restrict" سيمنع الـ cascade من إتمام حذف صف teachers، فتفشل
-- العملية بأكملها (تراجع كامل) برسالة خطأ قياسية (SQLSTATE 23503) —
-- تُعالَج بالواجهة برسالة عربية واضحة، دون أي منطق إضافي هنا.
--
-- SECURITY INVOKER (الافتراضي) — يعتمد على سياسة "super admins full access
-- on app_users"، فلا يستطيع تنفيذها إلا سوبر أدمن فعليًا.

create or replace function delete_teacher(p_teacher_id uuid)
returns void
language plpgsql
set search_path = public, extensions
as $$
begin
  delete from app_users where id = p_teacher_id and role = 'teacher';
end;
$$;

grant execute on function delete_teacher(uuid) to authenticated;

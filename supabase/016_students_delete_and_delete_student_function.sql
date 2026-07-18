-- [3] يوسّع صلاحيات المحفظ لتشمل حذف طلاب مركزه، ويضيف دالة delete_student
-- التي تنظّف حساب ولي الأمر المرتبط أيضًا (وليس فقط صف الطالب نفسه).

create policy "teachers delete own center students"
on students for delete
using (center_id = get_my_center_id());

-- تُستدعى من لوحة المحفظ لحذف طالب. تحذف حساب app_users الخاص بولي الأمر
-- أولًا (يُسقط معه صف parents تلقائيًا عبر on delete cascade)، ثم تحذف صف
-- الطالب نفسه (يُسقط معه progress_records وevaluations تلقائيًا) — تنظيف
-- كامل بدون أي حساب "يتيم" متبقٍّ.
--
-- SECURITY INVOKER (الافتراضي) — يعتمد على:
--   - "teachers delete own center students" (طلاب مركز المحفظ فقط)
--   - "teachers delete parent app_users for own center student" (الملف
--     التالي 017) لحذف حساب ولي الأمر
-- فلا يمكن لمحفظ حذف طالب خارج مركزه حتى عبر استدعاء هذه الدالة مباشرة.

create or replace function delete_student(p_student_id uuid)
returns void
language plpgsql
set search_path = public, extensions
as $$
declare
  v_parent_user_id uuid;
begin
  select id into v_parent_user_id from parents where student_id = p_student_id;

  if v_parent_user_id is not null then
    delete from app_users where id = v_parent_user_id;
  end if;

  delete from students where id = p_student_id;
end;
$$;

grant execute on function delete_student(uuid) to authenticated;

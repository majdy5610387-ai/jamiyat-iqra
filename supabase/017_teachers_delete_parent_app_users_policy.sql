-- يسمح لمحفظ بحذف حساب app_users (ولي الأمر) المرتبط بطالب في مركزه فقط
-- (تستخدمها delete_student من الملف السابق). بدون هذه السياسة، سيفشل
-- استدعاء delete_student من محفظ بنفس نوع خطأ RLS الذي واجهناه سابقًا مع
-- الإدراج.

create policy "teachers delete parent app_users for own center student"
on app_users for delete
using (
  role = 'parent'
  and id in (
    select p.id from parents p
    join students s on s.id = p.student_id
    where s.center_id = get_my_center_id()
  )
);

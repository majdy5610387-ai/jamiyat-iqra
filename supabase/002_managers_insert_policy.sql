-- إضافة سياسة RLS تسمح لمدير حالي فقط بإضافة صف مدير جديد إلى جدول managers.
-- شغّله من SQL Editor بلوحة تحكم Supabase (لا تنفيذ تلقائي).

create policy "managers can insert new managers"
on managers for insert
with check (is_manager());

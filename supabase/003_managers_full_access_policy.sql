-- ضروري لعمل قسم "إدارة المدراء" في لوحة المدير بشكل صحيح.
--
-- السياسة الحالية "managers select own row" تسمح فقط برؤية صف المدير
-- نفسه (id = auth.uid())، فلا يمكن لأي مدير رؤية بقية المدراء في القائمة.
-- هذه السياسة الجديدة تمنح أي مدير حالي (is_manager()) صلاحية كاملة
-- (select/insert/update/delete) على جدول managers، بنفس النمط المطبّق
-- فعليًا على بقية الجداول (centers, teachers, students, ...).
--
-- شغّله من SQL Editor بلوحة تحكم Supabase (لا تنفيذ تلقائي).
-- ملاحظة: سياسة 002 (managers can insert new managers) تبقى صحيحة ولا
-- تعارض هذه — Postgres يجمع السياسات المتعددة لنفس الجدول بمنطق OR.

create policy "managers full access on managers"
on managers for all
using (is_manager())
with check (is_manager());

-- إعادة تأكيد سياسة INSERT التي تسمح لمحفظ حالي بإنشاء صف "ولي أمر" جديد
-- في app_users. الأمر آمن لإعادة التشغيل (drop if exists ثم create) بغض
-- النظر عن كانت السياسة موجودة مسبقًا أو لا.
--
-- ملاحظة: لا يمكن ربط هذا التحقق بـ student_id هنا لأن app_users لا يحتوي
-- هذا العمود إطلاقًا — الحماية الفعلية من إساءة الاستخدام (منع ربط حساب
-- بطالب خارج مركز المحفظ) موجودة أصلًا في سياسة INSERT الخاصة بجدول parents
-- ("teachers insert parent for own center student")، ولا تحتاج تعديلًا.

drop policy if exists "teachers insert parent app_users" on app_users;

create policy "teachers insert parent app_users"
on app_users for insert
with check (role = 'parent' and get_my_center_id() is not null);

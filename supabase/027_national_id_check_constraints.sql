-- خط دفاع أخير: يفرض أن national_id بكل جدول يتكون من 9 أرقام بالضبط، بغض
-- النظر عما تسمح به الواجهة. لا تُشغّل هذا الملف قبل تشغيل
-- dev_check_national_id_violations.sql والتأكد أنه لا يُرجع أي صفوف —
-- وإلا ستفشل عملية إضافة القيد فورًا على أول صف مخالف موجود.
--
-- app_users يشمل كلا الدورين (teacher وparent)، لذا قيد واحد عليه يكفي
-- لكليهما. جدول parents غير مشمول عمدًا — عمود national_id به هو دائمًا
-- نسخة من نفس رقم هوية الطالب المرتبط (يُنسخ آليًا عند الإنشاء بواسطة
-- create_student_with_parent، وليس حقل إدخال منفصل بأي نموذج بالواجهة).

alter table students
  add constraint students_national_id_format check (national_id ~ '^[0-9]{9}$');

alter table app_users
  add constraint app_users_national_id_format check (national_id ~ '^[0-9]{9}$');

alter table teachers
  add constraint teachers_national_id_format check (national_id ~ '^[0-9]{9}$');

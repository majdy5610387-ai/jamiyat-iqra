-- محفظ تجريبي فقط لاختبار Edge Function (custom-login) — رقم الهوية وكلمة
-- المرور كلاهما "123456789". لا يوجد صف مطابق له في جدول teachers بعد (غير
-- ضروري لاختبار تسجيل الدخول/إصدار الـ JWT نفسه، فـ verify_credentials تتحقق
-- من app_users فقط). احذف هذا الصف لاحقًا إن لم ترغب بإبقائه بعد الاختبار.

insert into app_users (role, national_id, password_hash)
values (
  'teacher',
  '123456789',
  crypt('123456789', gen_salt('bf', 10))
);

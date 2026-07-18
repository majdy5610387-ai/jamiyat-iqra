-- تشخيص: يفحص الصف الفعلي المخزّن للمحفظ التجريبي بدون عرض password_hash نفسه.
-- password_matches: يعيد تنفيذ نفس مقارنة verify_credentials مباشرة، لعزل
-- المشكلة بين بيانات الصف نفسها وبين منطق الدالة/Edge Function.

select
  national_id,
  role,
  length(national_id) as national_id_len,
  length(role) as role_len,
  length(password_hash) as password_hash_len, -- bcrypt الطبيعي دائمًا 60
  failed_attempts,
  locked_until,
  (password_hash = crypt('123456789', password_hash)) as password_matches,
  created_at
from app_users
where national_id = '123456789';

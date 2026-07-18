-- تشخيصي فقط — شغّله أولًا قبل 027_national_id_check_constraints.sql للتأكد
-- أن كل البيانات الحالية تطابق نمط 9 أرقام بالضبط. إن رجعت أي صفوف هنا،
-- لا تُشغّل ملف 027 بعد — أخبر Claude بالنتيجة أولًا لتقرروا معًا كيفية
-- تصحيح تلك الصفوف (يدويًا عادة، غالبًا بيانات اختبار قديمة من dev_seed_*).

select 'students' as table_name, id, national_id
from students
where national_id !~ '^[0-9]{9}$'

union all

select 'app_users' as table_name, id, national_id
from app_users
where national_id !~ '^[0-9]{9}$'

union all

select 'teachers' as table_name, id, national_id
from teachers
where national_id !~ '^[0-9]{9}$';

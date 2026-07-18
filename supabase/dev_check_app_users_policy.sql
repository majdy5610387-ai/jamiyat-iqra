-- يعرض النص الفعلي (الحرفي) لشرطي USING وWITH CHECK لكل سياسة على app_users،
-- كما هو مُخزَّن فعليًا في قاعدة البيانات الآن — بغض النظر عمّا نظن أننا شغّلناه.

select
  polname as policy_name,
  case when polcmd = '*' then 'ALL'
       when polcmd = 'r' then 'SELECT'
       when polcmd = 'a' then 'INSERT'
       when polcmd = 'w' then 'UPDATE'
       when polcmd = 'd' then 'DELETE'
       else polcmd::text end as cmd,
  pg_get_expr(polqual, polrelid) as using_expr,
  pg_get_expr(polwithcheck, polrelid) as with_check_expr
from pg_policy
where polrelid = 'app_users'::regclass;

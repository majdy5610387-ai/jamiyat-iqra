-- تشخيصي فقط — يعرض توقيع add_progress_with_evaluation الحالي بقاعدتك.
-- إن ظهر عمود p_record_type ضمن الأعمدة، فالدالة محدَّثة بالفعل والمشكلة
-- غالبًا كاش مخطط PostgREST القديم (انتظر دقيقة أو أعد تشغيل المشروع من
-- Settings > General > Restart project). إن لم يظهر، فملف 029 لم يُشغَّل
-- بعد — شغّله الآن.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('add_progress_with_evaluation', 'update_progress_with_evaluation');

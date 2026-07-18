-- دالة تشخيص مؤقتة: تكشف بالضبط ماذا يرى الخادم من الجلسة الحالية عند
-- استدعائها من التطبيق (auth.uid()، ونتيجة get_my_center_id()، ودور الـ JWT).
-- يمكن حذفها لاحقًا بعد انتهاء التشخيص (drop function debug_whoami();).

create or replace function debug_whoami()
returns table (uid uuid, my_center_id uuid, jwt_role text)
language sql
stable
set search_path = public, extensions
as $$
  select auth.uid(), get_my_center_id(), auth.role();
$$;

grant execute on function debug_whoami() to authenticated;

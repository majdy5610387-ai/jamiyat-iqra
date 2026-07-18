-- حماية على مستوى قاعدة البيانات (بالإضافة لمنع الواجهة): تمنع أي مستخدم من
-- حذف صف نفسه في managers، أو سحب صلاحية is_super_admin عن نفسه، بغض النظر
-- عن الواجهة المستخدمة (حتى لو استُدعي عبر API مباشرة). هذا يكمّل منع
-- الواجهة، لا يغنيه، لتفادي انتهاء النظام بدون أي سوبر أدمن بالخطأ.

create or replace function prevent_self_demotion_or_deletion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if OLD.id = auth.uid() then
    if TG_OP = 'DELETE' then
      raise exception 'لا يمكنك حذف حسابك الخاص';
    end if;

    if TG_OP = 'UPDATE' and OLD.is_super_admin = true and NEW.is_super_admin = false then
      raise exception 'لا يمكنك إلغاء صلاحية المدير العام عن حسابك الخاص';
    end if;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

create trigger managers_prevent_self_demotion
before update or delete on managers
for each row execute function prevent_self_demotion_or_deletion();

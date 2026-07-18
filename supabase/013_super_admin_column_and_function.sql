-- تدرّج صلاحيات المدراء: عمود is_super_admin + دالة مساعدة للاستخدام في RLS.

alter table managers add column is_super_admin boolean not null default false;

create or replace function is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from managers where id = auth.uid() and is_super_admin = true
  );
$$;

revoke all on function is_super_admin() from public;
grant execute on function is_super_admin() to authenticated;

-- يعيد تقسيم صلاحيات managers/centers/teachers/students/app_users:
-- - سوبر أدمن (is_super_admin()): صلاحية كاملة كما كانت "أي مدير" سابقًا.
-- - مدير عادي (is_manager()): قراءة فقط على centers/teachers/students،
--   وبدون أي وصول لجدول managers عدا صفه الخاص (سياسة "managers select own
--   row" الحالية تبقى دون تغيير — تسمح له برؤية حالته الخاصة فقط، ليست
--   قائمة كل المدراء).

-- ------------------------------------------------------------
-- managers
-- ------------------------------------------------------------

drop policy if exists "managers full access on managers" on managers;
drop policy if exists "managers can insert new managers" on managers;

create policy "super admins full access on managers"
on managers for all
using (is_super_admin())
with check (is_super_admin());

-- ------------------------------------------------------------
-- centers
-- ------------------------------------------------------------

drop policy if exists "managers full access on centers" on centers;

create policy "super admins full access on centers"
on centers for all
using (is_super_admin())
with check (is_super_admin());

create policy "managers read centers"
on centers for select
using (is_manager());

-- ------------------------------------------------------------
-- teachers
-- ------------------------------------------------------------

drop policy if exists "managers full access on teachers" on teachers;

create policy "super admins full access on teachers"
on teachers for all
using (is_super_admin())
with check (is_super_admin());

create policy "managers read teachers"
on teachers for select
using (is_manager());

-- ------------------------------------------------------------
-- students
-- ------------------------------------------------------------

drop policy if exists "managers full access on students" on students;

create policy "super admins full access on students"
on students for all
using (is_super_admin())
with check (is_super_admin());

create policy "managers read students"
on students for select
using (is_manager());

-- ------------------------------------------------------------
-- app_users (يشمل القدرة على إضافة محفظين، لأنها تتطلب إدراج app_users)
-- ------------------------------------------------------------

drop policy if exists "managers full access on app_users" on app_users;

create policy "super admins full access on app_users"
on app_users for all
using (is_super_admin())
with check (is_super_admin());

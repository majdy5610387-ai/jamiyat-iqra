-- تخصيص مراكز لكل مدير عادي (سوبر أدمن يبقى غير مقيّد دائمًا). جدول ربط
-- بدل عمود واحد لأن مدير قد يحتاج صلاحية على أكثر من مركز بنفس الوقت.

create table manager_center_access (
  manager_id uuid not null references managers(id) on delete cascade,
  center_id uuid not null references centers(id) on delete cascade,
  primary key (manager_id, center_id)
);

alter table manager_center_access enable row level security;

-- سوبر أدمن فقط يقرأ/يكتب هذا الجدول مباشرة. المدير العادي لا يحتاج وصولًا
-- مباشرًا إطلاقًا — يعرف "مراكزه" عبر get_my_accessible_center_ids() فقط.
create policy "super admins full access on manager_center_access"
on manager_center_access for all
using (is_super_admin())
with check (is_super_admin());

-- ------------------------------------------------------------
-- students: تقييد قراءة المدير العادي بمراكزه المصرح بها فقط.
-- centers وteachers لا تتأثران عمدًا (القائمتان تبقيان مفتوحتين لكل مدير).
-- ------------------------------------------------------------

drop policy if exists "managers read students" on students;

create policy "managers read authorized center students"
on students for select
using (
  is_manager()
  and exists (
    select 1 from manager_center_access
    where manager_id = auth.uid() and center_id = students.center_id
  )
);

-- ------------------------------------------------------------
-- progress_records وevaluations: كانتا بسياسة موحّدة "for all" لأي مدير
-- (ثغرة كتابة قائمة أصلًا لم تستخدمها أي واجهة). نقسّمها لتطابق نمط
-- centers/teachers/students: سوبر أدمن كل شيء، مدير عادي قراءة فقط
-- ومقيّدة بمراكزه المصرح بها عبر ربط الطالب بمركزه.
-- ------------------------------------------------------------

drop policy if exists "managers full access on progress_records" on progress_records;

create policy "super admins full access on progress_records"
on progress_records for all
using (is_super_admin())
with check (is_super_admin());

create policy "managers read authorized center progress"
on progress_records for select
using (
  is_manager()
  and exists (
    select 1 from students s
    join manager_center_access mca on mca.center_id = s.center_id
    where s.id = progress_records.student_id and mca.manager_id = auth.uid()
  )
);

drop policy if exists "managers full access on evaluations" on evaluations;

create policy "super admins full access on evaluations"
on evaluations for all
using (is_super_admin())
with check (is_super_admin());

create policy "managers read authorized center evaluations"
on evaluations for select
using (
  is_manager()
  and exists (
    select 1 from students s
    join manager_center_access mca on mca.center_id = s.center_id
    where s.id = evaluations.student_id and mca.manager_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- دوال مساعدة
-- ------------------------------------------------------------

-- تُعيد معرّفات المراكز التي يقدر المدير الحالي فتح تفاصيلها: كل المراكز
-- لسوبر أدمن، أو فقط مراكزه المصرح بها لمدير عادي. تُستخدم بالواجهة لتحديد
-- أي زر "عرض الطلاب" يظهر مفعّلًا.
create or replace function get_my_accessible_center_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from centers
  where is_super_admin()
     or exists (
       select 1 from manager_center_access
       where manager_id = auth.uid() and center_id = centers.id
     );
$$;

grant execute on function get_my_accessible_center_ids() to authenticated;

-- تُستدعى من قسم "المدراء" (سوبر أدمن فقط) لحفظ تحديد مراكز مدير معيّن
-- دفعة واحدة: استبدال كامل (حذف ثم إدراج) داخل معاملة واحدة ذرية.
create or replace function set_manager_center_access(p_manager_id uuid, p_center_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'يتطلب صلاحية سوبر أدمن';
  end if;

  delete from manager_center_access where manager_id = p_manager_id;

  insert into manager_center_access (manager_id, center_id)
  select p_manager_id, unnest(p_center_ids);
end;
$$;

grant execute on function set_manager_center_access(uuid, uuid[]) to authenticated;

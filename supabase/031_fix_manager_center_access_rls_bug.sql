-- إصلاح ثغرة: سياسات RLS الخاصة بـ"مدير عادي يقرأ بيانات مركزه المصرح به"
-- (على students/progress_records/evaluations/honor_board_entries) كانت
-- تستعلم مباشرة عن جدول manager_center_access ضمن الاستعلام الفرعي (exists).
-- لكن manager_center_access نفسه مفعّل عليه RLS بسياسة تسمح فقط لسوبر أدمن
-- بالقراءة — فالاستعلام الفرعي، إذ يُنفَّذ بصلاحيات المدير العادي نفسه (لا
-- صلاحيات مرتفعة)، يرى صفر صفوف دائمًا مهما كانت البيانات الفعلية، فتفشل
-- exists(...) دومًا وتُرجَع قوائم فاضية بصمت (RLS تُصفّي دون خطأ).
--
-- الحل: دالة SECURITY DEFINER تتجاوز RLS للفحص الداخلي فقط (بنفس نمط
-- is_manager()/is_super_admin() الموجودتين أصلًا لنفس السبب بالضبط).

create or replace function is_authorized_center_manager(p_center_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from manager_center_access
    where manager_id = auth.uid() and center_id = p_center_id
  );
$$;

revoke all on function is_authorized_center_manager(uuid) from public;
grant execute on function is_authorized_center_manager(uuid) to authenticated;

-- ------------------------------------------------------------
-- students
-- ------------------------------------------------------------

drop policy if exists "managers read authorized center students" on students;

create policy "managers read authorized center students"
on students for select
using (
  is_manager()
  and is_authorized_center_manager(students.center_id)
);

-- ------------------------------------------------------------
-- progress_records
-- ------------------------------------------------------------

drop policy if exists "managers read authorized center progress" on progress_records;

create policy "managers read authorized center progress"
on progress_records for select
using (
  is_manager()
  and exists (
    select 1 from students s
    where s.id = progress_records.student_id
      and is_authorized_center_manager(s.center_id)
  )
);

-- ------------------------------------------------------------
-- evaluations
-- ------------------------------------------------------------

drop policy if exists "managers read authorized center evaluations" on evaluations;

create policy "managers read authorized center evaluations"
on evaluations for select
using (
  is_manager()
  and exists (
    select 1 from students s
    where s.id = evaluations.student_id
      and is_authorized_center_manager(s.center_id)
  )
);

-- ------------------------------------------------------------
-- honor_board_entries
-- ------------------------------------------------------------

drop policy if exists "managers read authorized center honor board" on honor_board_entries;

create policy "managers read authorized center honor board"
on honor_board_entries for select
using (
  is_manager()
  and is_authorized_center_manager(honor_board_entries.center_id)
);

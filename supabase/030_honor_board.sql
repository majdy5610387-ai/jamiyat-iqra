-- "لوحة الشرف": اختيار يدوي بحت من المحفظ، قسمان مستقلان (overall/weekly)،
-- بلا أي إعادة تعيين تلقائية — التسمية "أسبوعي" مجرد تصنيف يختاره المحفظ.

create table honor_board_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  center_id uuid not null references centers(id) on delete cascade,
  category text not null check (category in ('overall', 'weekly')),
  added_by uuid references teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, category)
);

create index idx_honor_board_center_category on honor_board_entries(center_id, category);

alter table honor_board_entries enable row level security;

create policy "super admins full access on honor_board_entries"
on honor_board_entries for all
using (is_super_admin())
with check (is_super_admin());

create policy "teachers read own center honor board"
on honor_board_entries for select
using (center_id = get_my_center_id());

create policy "managers read authorized center honor board"
on honor_board_entries for select
using (
  is_manager()
  and exists (
    select 1 from manager_center_access
    where manager_id = auth.uid() and center_id = honor_board_entries.center_id
  )
);

-- عمدًا: لا توجد أي سياسة INSERT/UPDATE/DELETE للمحفظ أو المدير — الكتابة
-- حصرًا عبر set_honor_board() أدناه (SECURITY DEFINER)، فيكون هذا المسار
-- الوحيد الممكن للتعديل، وبه يُفرَض حد الـ5 (لا يوجد قيد CHECK ممكن أصلًا
-- عبر عدة صفوف بـPostgres).

-- ------------------------------------------------------------
-- استبدال كامل لقسم واحد بمركز واحد: حذف كل صفوف (center_id, category)
-- الحالية ثم إدراج القائمة الجديدة، بمعاملة واحدة ذرية.
-- ------------------------------------------------------------

create or replace function set_honor_board(
  p_center_id uuid,
  p_category text,
  p_student_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_category not in ('overall', 'weekly') then
    raise exception 'تصنيف غير صحيح';
  end if;

  if array_length(coalesce(p_student_ids, '{}'::uuid[]), 1) > 5 then
    raise exception 'لا يمكن اختيار أكثر من 5 طلاب لهذا القسم';
  end if;

  -- سوبر أدمن دائمًا، أو محفظ مركزه هو نفسه p_center_id تحديدًا (منع محفظ
  -- من التأثير على لوحة شرف مركز آخر حتى لو خمّن معرّفه).
  if not (is_super_admin() or get_my_center_id() = p_center_id) then
    raise exception 'لا تملك صلاحية تعديل لوحة شرف هذا المركز';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_student_ids, '{}'::uuid[])) as sid
    where not exists (select 1 from students where id = sid and center_id = p_center_id)
  ) then
    raise exception 'أحد الطلاب المحددين لا ينتمي لهذا المركز';
  end if;

  delete from honor_board_entries where center_id = p_center_id and category = p_category;

  insert into honor_board_entries (student_id, center_id, category, added_by)
  select
    sid,
    p_center_id,
    p_category,
    case when exists (select 1 from teachers where id = auth.uid()) then auth.uid() else null end
  from unnest(coalesce(p_student_ids, '{}'::uuid[])) as sid;
end;
$$;

grant execute on function set_honor_board(uuid, text, uuid[]) to authenticated;

-- ------------------------------------------------------------
-- ولي الأمر: اسم الطالب فقط، بلا وصول مباشر للجدول (RLS أعلاه لا تمنحه أي
-- صلاحية). المركز يُحدَّد من هوية ولي الأمر نفسه بالخادم، وليس معاملًا
-- يرسله العميل.
-- ------------------------------------------------------------

create or replace function get_child_center_honor_board()
returns table (
  category text,
  student_id uuid,
  first_name text,
  father_name text,
  grandfather_name text,
  family_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select hbe.category, s.id, s.first_name, s.father_name, s.grandfather_name, s.family_name
  from honor_board_entries hbe
  join students s on s.id = hbe.student_id
  where hbe.center_id = (select center_id from students where id = get_my_child_id())
  order by hbe.category, hbe.created_at;
$$;

grant execute on function get_child_center_honor_board() to authenticated;

-- ------------------------------------------------------------
-- نقل طالب لمركز آخر يزيله من لوحة شرف مركزه القديم (قرار محفظي المركز
-- القديم تحديدًا، لا معنى لنقله تلقائيًا لمركز جديد لم يختره محفظوه).
-- ------------------------------------------------------------

create or replace function transfer_student(
  p_student_id uuid,
  p_new_center_id uuid,
  p_new_teacher_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'يتطلب صلاحية سوبر أدمن';
  end if;

  if not exists (
    select 1 from teachers where id = p_new_teacher_id and center_id = p_new_center_id
  ) then
    raise exception 'المحفظ المحدد لا ينتمي للمركز المحدد';
  end if;

  update students
  set center_id = p_new_center_id, teacher_id = p_new_teacher_id
  where id = p_student_id and deletion_requested_at is null;

  if not found then
    raise exception 'تعذّر نقل الطالب: إما أنه غير موجود أو لديه طلب حذف معلّق بانتظار الموافقة';
  end if;

  delete from honor_board_entries where student_id = p_student_id;
end;
$$;

create or replace function transfer_teacher_students(
  p_old_teacher_id uuid,
  p_new_center_id uuid,
  p_new_teacher_id uuid
)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_transferred_ids uuid[];
begin
  if not is_super_admin() then
    raise exception 'يتطلب صلاحية سوبر أدمن';
  end if;

  if not exists (
    select 1 from teachers where id = p_new_teacher_id and center_id = p_new_center_id
  ) then
    raise exception 'المحفظ المحدد لا ينتمي للمركز المحدد';
  end if;

  with updated as (
    update students
    set center_id = p_new_center_id, teacher_id = p_new_teacher_id
    where teacher_id = p_old_teacher_id and deletion_requested_at is null
    returning id
  )
  select array_agg(id) into v_transferred_ids from updated;

  if v_transferred_ids is not null then
    delete from honor_board_entries where student_id = any(v_transferred_ids);
  end if;

  return coalesce(array_length(v_transferred_ids, 1), 0);
end;
$$;

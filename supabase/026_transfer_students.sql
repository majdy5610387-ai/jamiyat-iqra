-- نقل الطلاب (فردي وجماعي) بصلاحية سوبر أدمن فقط. سجلات الحفظ والتقييمات
-- التاريخية (progress_records/evaluations) لا تُلمَس عمدًا — teacher_id بها
-- يمثّل "من قام فعلًا بهذه الجلسة"، وهي حقيقة تاريخية لا تتغيّر بتغيّر محفظ
-- الطالب الحالي.

-- نقل طالب واحد. يرفض بخطأ صريح لو الطالب غير موجود أو لديه طلب حذف معلّق،
-- ولو المحفظ الجديد لا ينتمي فعليًا للمركز الجديد (تحقق تكامل إضافي، دفاع
-- بالعمق فوق تصفية الواجهة).
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
end;
$$;

-- نقل كل طلاب محفظ دفعة واحدة. الطلاب الذين لديهم طلب حذف معلّق يُستثنَون
-- تلقائيًا (صامتًا) من عملية النقل بدل رفض الدفعة كاملة، وتُعاد عدد من نُقل
-- فعليًا حتى تعرضه الواجهة بوضوح ("تم نقل X من أصل Y").
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
  v_transferred int;
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
  select count(*) into v_transferred from updated;

  return v_transferred;
end;
$$;

grant execute on function transfer_student(uuid, uuid, uuid) to authenticated;
grant execute on function transfer_teacher_students(uuid, uuid, uuid) to authenticated;

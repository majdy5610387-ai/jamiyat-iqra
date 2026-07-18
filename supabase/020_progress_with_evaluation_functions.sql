-- دالتان تديران النموذج الموحّد (سجل حفظ + تقييم اختياري لنفس السجل).
-- SECURITY INVOKER (الافتراضي) في كليهما — تعتمد كليًا على سياسات RLS
-- الحالية "teachers manage own center progress/evaluations" (ALL)، فلا
-- يمكن لمحفظ التأثير إلا على طلاب مركزه.

create or replace function add_progress_with_evaluation(
  p_progress_id uuid,
  p_student_id uuid,
  p_teacher_id uuid,
  p_date date,
  p_surah text,
  p_from_ayah int,
  p_to_ayah int,
  p_notes text,
  p_rating int
)
returns table (progress_id uuid, evaluation_id uuid)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_evaluation_id uuid;
begin
  insert into progress_records (id, student_id, teacher_id, date, surah, from_ayah, to_ayah, notes)
  values (p_progress_id, p_student_id, p_teacher_id, p_date, p_surah, p_from_ayah, p_to_ayah, p_notes);

  if p_rating is not null then
    v_evaluation_id := gen_random_uuid();
    insert into evaluations (id, student_id, teacher_id, date, rating, notes, progress_record_id)
    values (v_evaluation_id, p_student_id, p_teacher_id, p_date, p_rating, null, p_progress_id);
  end if;

  return query select p_progress_id, v_evaluation_id;
end;
$$;

grant execute on function add_progress_with_evaluation(
  uuid, uuid, uuid, date, text, int, int, text, int
) to authenticated;

-- تعديل سجل موجود: يحدّث سجل الحفظ، ثم يوفّق حالة التقييم المرتبط حسب
-- p_rating (يحذف التقييم لو أصبح null، يحدّثه لو موجود، أو ينشئه لو لم يكن
-- موجودًا من قبل وأصبح له تقييم الآن).

create or replace function update_progress_with_evaluation(
  p_progress_id uuid,
  p_date date,
  p_surah text,
  p_from_ayah int,
  p_to_ayah int,
  p_notes text,
  p_rating int
)
returns void
language plpgsql
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_teacher_id uuid;
  v_existing_evaluation_id uuid;
begin
  update progress_records
  set date = p_date, surah = p_surah, from_ayah = p_from_ayah, to_ayah = p_to_ayah, notes = p_notes
  where id = p_progress_id
  returning student_id, teacher_id into v_student_id, v_teacher_id;

  if not found then
    raise exception 'سجل الحفظ غير موجود أو لا تملك صلاحية تعديله';
  end if;

  select id into v_existing_evaluation_id
  from evaluations
  where progress_record_id = p_progress_id;

  if p_rating is null then
    if v_existing_evaluation_id is not null then
      delete from evaluations where id = v_existing_evaluation_id;
    end if;
  elsif v_existing_evaluation_id is not null then
    update evaluations
    set rating = p_rating, date = p_date
    where id = v_existing_evaluation_id;
  else
    insert into evaluations (id, student_id, teacher_id, date, rating, notes, progress_record_id)
    values (gen_random_uuid(), v_student_id, v_teacher_id, p_date, p_rating, null, p_progress_id);
  end if;
end;
$$;

grant execute on function update_progress_with_evaluation(
  uuid, date, text, int, int, text, int
) to authenticated;

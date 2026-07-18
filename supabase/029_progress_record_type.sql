-- حقل "حالة الحفظ": حفظ جديد أم مراجعة. قيم إنجليزية قصيرة مخزَّنة (نفس نمط
-- app_users.role) والتسميات العربية بالواجهة فقط.
--
-- إجباري (not null) من الآن فصاعدًا — بيانات تصنيفية مهمة يجب أن يحددها
-- المحفظ عند كل سجل، لا معنى لتركها غير محددة لسجلات جديدة.
--
-- السجلات القديمة: نُدرجها كـ'new' (حفظ جديد) بصفتها الافتراض الأقرب
-- للواقع الغالب قبل وجود هذا التصنيف أصلًا — تقدير تقريبي لا أكثر (لا يوجد
-- سبيل لمعرفة الحالة الحقيقية لسجل قديم بأثر رجعي)، لكنه حقل عرضي/معلوماتي
-- بحت لا يدخل بأي حساب أو تقرير حسّاس، فخطأ التقدير هنا منخفض الأثر.

alter table progress_records
  add column record_type text not null default 'new'
    check (record_type in ('new', 'review'));

-- ------------------------------------------------------------
-- تحديث الدالتين لقبول الحقل الجديد. لازم drop صريح أولًا: توقيع المعاملات
-- تغيّر (معامل جديد)، وPostgres يعامل create or replace بتوقيع مختلف كدالة
-- إضافية منفصلة (overload) بدل استبدال القديمة، فتبقى النسخة القديمة يتيمة
-- بلا داعٍ.
-- ------------------------------------------------------------

drop function if exists add_progress_with_evaluation(
  uuid, uuid, uuid, date, text, int, int, text, int
);
drop function if exists update_progress_with_evaluation(
  uuid, date, text, int, int, text, int
);

create or replace function add_progress_with_evaluation(
  p_progress_id uuid,
  p_student_id uuid,
  p_teacher_id uuid,
  p_date date,
  p_surah text,
  p_from_ayah int,
  p_to_ayah int,
  p_notes text,
  p_rating int,
  p_record_type text
)
returns table (progress_id uuid, evaluation_id uuid)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_evaluation_id uuid;
begin
  if exists (
    select 1 from students where id = p_student_id and deletion_requested_at is not null
  ) then
    raise exception 'لا يمكن إضافة سجل حفظ لطالب بانتظار الموافقة على حذفه';
  end if;

  insert into progress_records (
    id, student_id, teacher_id, date, surah, from_ayah, to_ayah, notes, record_type
  )
  values (
    p_progress_id, p_student_id, p_teacher_id, p_date, p_surah, p_from_ayah, p_to_ayah,
    p_notes, p_record_type
  );

  if p_rating is not null then
    v_evaluation_id := gen_random_uuid();
    insert into evaluations (id, student_id, teacher_id, date, rating, notes, progress_record_id)
    values (v_evaluation_id, p_student_id, p_teacher_id, p_date, p_rating, null, p_progress_id);
  end if;

  return query select p_progress_id, v_evaluation_id;
end;
$$;

grant execute on function add_progress_with_evaluation(
  uuid, uuid, uuid, date, text, int, int, text, int, text
) to authenticated;

create or replace function update_progress_with_evaluation(
  p_progress_id uuid,
  p_date date,
  p_surah text,
  p_from_ayah int,
  p_to_ayah int,
  p_notes text,
  p_rating int,
  p_record_type text
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
  set date = p_date, surah = p_surah, from_ayah = p_from_ayah, to_ayah = p_to_ayah,
      notes = p_notes, record_type = p_record_type
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
  uuid, date, text, int, int, text, int, text
) to authenticated;

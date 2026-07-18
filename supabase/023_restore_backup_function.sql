-- تستعيد نسخة احتياطية كاملة (باستثناء managers، مستثنى عمدًا — راجع
-- التعليقات بالواجهة). p_mode: 'replace' (يمسح كل شيء أولًا ثم يُدرج من
-- الملف) أو 'merge' (upsert بمعرّف كل صف، لا يحذف أي شيء غير مذكور بالملف).
--
-- تحقق صريح من is_super_admin() كأول خطوة — ضروري، وليس زائدًا عن RLS:
-- بعض الجداول (parents/progress_records/evaluations) صلاحياتها الحالية
-- مبنية على is_manager() العام، فبدون هذا التحقق قد يبدأ مدير عادي عملية
-- حذف جزئية تتوقف بمنتصفها بخطأ صلاحيات على جدول آخر (centers/teachers/
-- students/app_users مبنية على is_super_admin() تحديدًا)، تاركة القاعدة
-- بحالة تالفة جزئيًا.
--
-- كل شيء داخل استدعاء دالة واحد = معاملة Postgres واحدة ذرية بالكامل: أي
-- خطأ غير متوقَّع بأي خطوة يُلغي كل التغييرات تلقائيًا، لا يوجد احتمال
-- استعادة جزئية متضررة أبدًا.

create or replace function restore_backup(
  p_backup jsonb,
  p_mode text
)
returns void
language plpgsql
set search_path = public, extensions
as $$
begin
  if not is_super_admin() then
    raise exception 'يتطلب صلاحية سوبر أدمن';
  end if;

  if p_mode not in ('replace', 'merge') then
    raise exception 'وضع استعادة غير صحيح: يجب أن يكون replace أو merge';
  end if;

  if p_mode = 'replace' then
    -- ترتيب الحذف يحترم المفاتيح الخارجية (الأبناء أولًا)
    delete from evaluations;
    delete from progress_records;
    delete from parents;
    delete from students;
    delete from teachers;
    delete from app_users;
    delete from centers;
  end if;

  -- ترتيب الإدراج يحترم المفاتيح الخارجية (الآباء أولًا)

  insert into centers (id, name, address, created_at)
  select
    (r->>'id')::uuid,
    r->>'name',
    r->>'address',
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_backup->'centers', '[]'::jsonb)) as r
  on conflict (id) do update set
    name = excluded.name,
    address = excluded.address;

  insert into app_users (id, role, national_id, password_hash, failed_attempts, locked_until, created_at)
  select
    (r->>'id')::uuid,
    r->>'role',
    r->>'national_id',
    r->>'password_hash',
    coalesce((r->>'failed_attempts')::int, 0),
    (r->>'locked_until')::timestamptz,
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_backup->'app_users', '[]'::jsonb)) as r
  on conflict (id) do update set
    role = excluded.role,
    national_id = excluded.national_id,
    password_hash = excluded.password_hash,
    failed_attempts = excluded.failed_attempts,
    locked_until = excluded.locked_until;

  insert into teachers (id, full_name, national_id, phone, center_id, created_at)
  select
    (r->>'id')::uuid,
    r->>'full_name',
    r->>'national_id',
    r->>'phone',
    (r->>'center_id')::uuid,
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_backup->'teachers', '[]'::jsonb)) as r
  on conflict (id) do update set
    full_name = excluded.full_name,
    national_id = excluded.national_id,
    phone = excluded.phone,
    center_id = excluded.center_id;

  insert into students (
    id, national_id, first_name, father_name, grandfather_name, family_name,
    birth_date, phone, center_id, teacher_id, created_at, updated_at
  )
  select
    (r->>'id')::uuid,
    r->>'national_id',
    r->>'first_name',
    r->>'father_name',
    r->>'grandfather_name',
    r->>'family_name',
    (r->>'birth_date')::date,
    r->>'phone',
    (r->>'center_id')::uuid,
    (r->>'teacher_id')::uuid,
    coalesce((r->>'created_at')::timestamptz, now()),
    coalesce((r->>'updated_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_backup->'students', '[]'::jsonb)) as r
  on conflict (id) do update set
    national_id = excluded.national_id,
    first_name = excluded.first_name,
    father_name = excluded.father_name,
    grandfather_name = excluded.grandfather_name,
    family_name = excluded.family_name,
    birth_date = excluded.birth_date,
    phone = excluded.phone,
    center_id = excluded.center_id,
    teacher_id = excluded.teacher_id,
    updated_at = excluded.updated_at;

  insert into parents (id, student_id, national_id, created_at)
  select
    (r->>'id')::uuid,
    (r->>'student_id')::uuid,
    r->>'national_id',
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_backup->'parents', '[]'::jsonb)) as r
  on conflict (id) do update set
    student_id = excluded.student_id,
    national_id = excluded.national_id;

  insert into progress_records (id, student_id, teacher_id, date, surah, from_ayah, to_ayah, notes, created_at)
  select
    (r->>'id')::uuid,
    (r->>'student_id')::uuid,
    (r->>'teacher_id')::uuid,
    (r->>'date')::date,
    r->>'surah',
    (r->>'from_ayah')::int,
    (r->>'to_ayah')::int,
    r->>'notes',
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_backup->'progress_records', '[]'::jsonb)) as r
  on conflict (id) do update set
    student_id = excluded.student_id,
    teacher_id = excluded.teacher_id,
    date = excluded.date,
    surah = excluded.surah,
    from_ayah = excluded.from_ayah,
    to_ayah = excluded.to_ayah,
    notes = excluded.notes;

  insert into evaluations (id, student_id, teacher_id, date, rating, notes, progress_record_id, created_at)
  select
    (r->>'id')::uuid,
    (r->>'student_id')::uuid,
    (r->>'teacher_id')::uuid,
    (r->>'date')::date,
    (r->>'rating')::int,
    r->>'notes',
    (r->>'progress_record_id')::uuid,
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_backup->'evaluations', '[]'::jsonb)) as r
  on conflict (id) do update set
    student_id = excluded.student_id,
    teacher_id = excluded.teacher_id,
    date = excluded.date,
    rating = excluded.rating,
    notes = excluded.notes,
    progress_record_id = excluded.progress_record_id;
end;
$$;

grant execute on function restore_backup(jsonb, text) to authenticated;

-- نظام "موافقة على حذف الطلاب": المحفظ يقدّم طلب حذف بدل الحذف الفوري،
-- والسوبر أدمن فقط من يوافق (حذف فعلي) أو يرفض. عمودان بدل جدول منفصل —
-- يكفي "هل هناك طلب معلّق حاليًا؟" دون حاجة لسجل تاريخي بطلبات سابقة.

alter table students
  add column deletion_requested_at timestamptz,
  add column deletion_requested_by uuid references teachers(id) on delete set null;

-- فهرس جزئي: يسرّع استعلام "طلبات الحذف المعلّقة" بلوحة المدير (لا حاجة
-- لفهرسة كل الصفوف، فقط النادرة التي فيها طلب فعلي).
create index idx_students_deletion_pending
  on students (deletion_requested_at)
  where deletion_requested_at is not null;

-- ------------------------------------------------------------
-- منع الحذف المباشر للمحفظ — يبقى فقط لسوبر أدمن (عبر السياسة الموجودة
-- مسبقًا "super admins full access on students/app_users" من ملف 014)
-- ------------------------------------------------------------

drop policy if exists "teachers delete own center students" on students;
drop policy if exists "teachers delete parent app_users for own center student" on app_users;

-- لا حاجة لسياسة UPDATE جديدة لعمودي الطلب: سياسة "teachers update own
-- center students" الموجودة مسبقًا تغطيهما تلقائيًا (تسمح للمحفظ بتعديل أي
-- عمود بطلاب مركزه، وهذا ما يستخدمه أصلًا نموذج تعديل بيانات الطالب).

-- ------------------------------------------------------------
-- تقديم/إلغاء طلب الحذف
-- ------------------------------------------------------------

-- يُستدعى من المحفظ لتقديم طلب حذف طالب بمركزه. deletion_requested_by
-- تُحدَّد من الخادم (auth.uid()) دائمًا، وليست قيمة يرسلها العميل — يمنع أي
-- احتمال إرسال معرّف محفظ آخر بدل نفسه.
create or replace function request_student_deletion(p_student_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update students
  set deletion_requested_at = now(), deletion_requested_by = auth.uid()
  where id = p_student_id;

  if not found then
    raise exception 'الطالب غير موجود أو لا تملك صلاحية الوصول إليه';
  end if;
end;
$$;

-- تُستخدم في حالتين مختلفتين بنفس الأثر: المحفظ يلغي طلبه الخاص، أو السوبر
-- أدمن يرفض الطلب — RLS الحالية (center_id لمحفظ، أو is_super_admin())
-- تحدّد من المسموح له فعلًا استدعاؤها بنجاح على أي صف.
create or replace function cancel_student_deletion_request(p_student_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update students
  set deletion_requested_at = null, deletion_requested_by = null
  where id = p_student_id;

  if not found then
    raise exception 'الطالب غير موجود أو لا تملك صلاحية الوصول إليه';
  end if;
end;
$$;

grant execute on function request_student_deletion(uuid) to authenticated;
grant execute on function cancel_student_deletion_request(uuid) to authenticated;

-- ------------------------------------------------------------
-- الموافقة على الحذف = استدعاء delete_student الموجودة، مع تحقق صريح
-- إضافي من is_super_admin() (بدل الاعتماد على RLS فقط) حتى تفشل بخطأ واضح
-- لا بصمت لو استُدعيت خطأً من غير سوبر أدمن.
-- ------------------------------------------------------------

create or replace function delete_student(p_student_id uuid)
returns void
language plpgsql
set search_path = public, extensions
as $$
declare
  v_parent_user_id uuid;
begin
  if not is_super_admin() then
    raise exception 'يتطلب صلاحية سوبر أدمن';
  end if;

  select id into v_parent_user_id from parents where student_id = p_student_id;

  if v_parent_user_id is not null then
    delete from app_users where id = v_parent_user_id;
  end if;

  delete from students where id = p_student_id;
end;
$$;

-- ------------------------------------------------------------
-- منع إضافة سجل حفظ/تقييم جديد لطالب بانتظار الموافقة على حذفه — يبقى
-- بإمكان المحفظ رؤية السجلات القديمة وتعديلها، فقط لا يُضاف سجل جديد.
-- ------------------------------------------------------------

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
  if exists (
    select 1 from students where id = p_student_id and deletion_requested_at is not null
  ) then
    raise exception 'لا يمكن إضافة سجل حفظ لطالب بانتظار الموافقة على حذفه';
  end if;

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

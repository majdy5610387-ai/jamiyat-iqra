-- ============================================================
-- نظام إدارة مراكز تحفيظ القرآن الكريم — مخطط قاعدة البيانات
-- شغّل هذا الملف كاملًا مرة واحدة من SQL Editor بلوحة تحكم Supabase
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- الجداول
-- ------------------------------------------------------------

create table centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table managers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  national_id text not null unique,
  phone text,
  center_id uuid not null references centers(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  national_id text not null unique,
  first_name text not null,
  father_name text not null,
  grandfather_name text not null,
  family_name text not null,
  birth_date date not null,
  phone text not null,
  center_id uuid not null references centers(id) on delete restrict,
  teacher_id uuid not null references teachers(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table parents (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id uuid not null unique references students(id) on delete cascade,
  national_id text not null,
  created_at timestamptz not null default now()
);

create table progress_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete restrict,
  date date not null,
  surah text not null,
  from_ayah int not null check (from_ayah > 0),
  to_ayah int not null check (to_ayah >= from_ayah),
  notes text,
  created_at timestamptz not null default now()
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete restrict,
  date date not null,
  rating int not null check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- فهارس لتسريع فلترة RLS والاستعلامات الشائعة
-- ------------------------------------------------------------

create index idx_teachers_center_id on teachers(center_id);
create index idx_students_center_id on students(center_id);
create index idx_students_teacher_id on students(teacher_id);
create index idx_progress_student_id on progress_records(student_id);
create index idx_progress_teacher_id on progress_records(teacher_id);
create index idx_evaluations_student_id on evaluations(student_id);
create index idx_evaluations_teacher_id on evaluations(teacher_id);

-- ------------------------------------------------------------
-- تحديث updated_at تلقائيًا عند تعديل الطالب
-- ------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger students_set_updated_at
before update on students
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- دوال مساعدة تُستخدم داخل سياسات RLS
-- security definer: تعمل بصلاحيات المالك فتتجاوز RLS الخاصة
-- بجداول teachers/managers/parents عند القراءة الداخلية فقط،
-- وتُعيد دائمًا بيانات المستخدم الحالي (auth.uid()) فقط لا غير.
-- ------------------------------------------------------------

create or replace function is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from managers where id = auth.uid());
$$;

create or replace function get_my_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select center_id from teachers where id = auth.uid();
$$;

create or replace function get_my_child_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select student_id from parents where id = auth.uid();
$$;

revoke all on function is_manager() from public;
revoke all on function get_my_center_id() from public;
revoke all on function get_my_child_id() from public;
grant execute on function is_manager() to authenticated;
grant execute on function get_my_center_id() to authenticated;
grant execute on function get_my_child_id() to authenticated;

-- ------------------------------------------------------------
-- تفعيل Row Level Security على كل الجداول
-- ------------------------------------------------------------

alter table centers enable row level security;
alter table managers enable row level security;
alter table teachers enable row level security;
alter table students enable row level security;
alter table parents enable row level security;
alter table progress_records enable row level security;
alter table evaluations enable row level security;

-- ------------------------------------------------------------
-- سياسات centers
-- ------------------------------------------------------------

create policy "managers full access on centers"
on centers for all
using (is_manager())
with check (is_manager());

create policy "teachers read own center"
on centers for select
using (id = get_my_center_id());

create policy "parents read child center"
on centers for select
using (id = (select center_id from students where id = get_my_child_id()));

-- ------------------------------------------------------------
-- سياسات managers (لا صلاحية كتابة عبر التطبيق، إدارة يدوية فقط)
-- ------------------------------------------------------------

create policy "managers select own row"
on managers for select
using (id = auth.uid());

-- ------------------------------------------------------------
-- سياسات teachers
-- ------------------------------------------------------------

create policy "managers full access on teachers"
on teachers for all
using (is_manager())
with check (is_manager());

create policy "teachers select own row"
on teachers for select
using (id = auth.uid());

create policy "teachers update own row"
on teachers for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "parents read child teacher"
on teachers for select
using (id = (select teacher_id from students where id = get_my_child_id()));

-- ------------------------------------------------------------
-- سياسات students
-- ------------------------------------------------------------

create policy "managers full access on students"
on students for all
using (is_manager())
with check (is_manager());

create policy "teachers select own center students"
on students for select
using (center_id = get_my_center_id());

create policy "teachers insert own center students"
on students for insert
with check (center_id = get_my_center_id() and teacher_id = auth.uid());

create policy "teachers update own center students"
on students for update
using (center_id = get_my_center_id())
with check (center_id = get_my_center_id());

create policy "parents read own child"
on students for select
using (id = get_my_child_id());

-- ------------------------------------------------------------
-- سياسات parents
-- ------------------------------------------------------------

create policy "managers full access on parents"
on parents for all
using (is_manager())
with check (is_manager());

create policy "teachers insert parent for own center student"
on parents for insert
with check (
  student_id in (select id from students where center_id = get_my_center_id())
);

create policy "parents select own row"
on parents for select
using (id = auth.uid());

-- ------------------------------------------------------------
-- سياسات progress_records
-- ------------------------------------------------------------

create policy "managers full access on progress_records"
on progress_records for all
using (is_manager())
with check (is_manager());

create policy "teachers manage own center progress"
on progress_records for all
using (
  teacher_id = auth.uid()
  and student_id in (select id from students where center_id = get_my_center_id())
)
with check (
  teacher_id = auth.uid()
  and student_id in (select id from students where center_id = get_my_center_id())
);

create policy "parents read child progress"
on progress_records for select
using (student_id = get_my_child_id());

-- ------------------------------------------------------------
-- سياسات evaluations
-- ------------------------------------------------------------

create policy "managers full access on evaluations"
on evaluations for all
using (is_manager())
with check (is_manager());

create policy "teachers manage own center evaluations"
on evaluations for all
using (
  teacher_id = auth.uid()
  and student_id in (select id from students where center_id = get_my_center_id())
)
with check (
  teacher_id = auth.uid()
  and student_id in (select id from students where center_id = get_my_center_id())
);

create policy "parents read child evaluations"
on evaluations for select
using (student_id = get_my_child_id());

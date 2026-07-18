-- جدول الهويات المخصصة (Custom Auth) للمحفظ وولي الأمر فقط.
-- المدير يبقى على Supabase Auth العادي (managers.id -> auth.users.id) بدون أي تغيير.

create table app_users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('teacher', 'parent')),
  national_id text not null,
  password_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  unique (national_id, role)
);

alter table app_users enable row level security;

-- إخفاء عمود password_hash بنيويًا عن أي استعلام REST، حتى لو كانت سياسات RLS
-- تسمح بالوصول للصف نفسه (حماية مستقلة عن RLS، على مستوى العمود).
revoke select on app_users from authenticated, anon;
grant select (id, role, national_id, failed_attempts, locked_until, created_at)
  on app_users to authenticated, anon;

-- مدير حالي: صلاحية كاملة (لإنشاء حسابات محفظين، ولإلغاء قفل حساب عند الحاجة)
create policy "managers full access on app_users"
on app_users for all
using (is_manager())
with check (is_manager());

-- محفظ حالي: يمكنه إنشاء صف "ولي أمر" فقط (عند إضافة طالب جديد لاحقًا)
create policy "teachers insert parent app_users"
on app_users for insert
with check (role = 'parent' and get_my_center_id() is not null);

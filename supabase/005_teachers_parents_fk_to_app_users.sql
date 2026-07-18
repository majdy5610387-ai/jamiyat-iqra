-- ينقل مرجعية teachers.id و parents.id من auth.users إلى app_users.
-- ملاحظة: الجدولان فارغان حاليًا (لم يُنشأ أي محفظ/ولي أمر ناجح بعد)، لذا هذا
-- التعديل آمن وفوري.

-- إن فشل أمر "drop constraint" لاختلاف اسم القيد تلقائيًا، شغّل أولًا:
--   select conname from pg_constraint where conrelid = 'teachers'::regclass and contype = 'f';
--   select conname from pg_constraint where conrelid = 'parents'::regclass and contype = 'f';
-- واستبدل الاسم أدناه بالاسم الفعلي الذي يظهر لديك.

alter table teachers drop constraint teachers_id_fkey;
alter table teachers add constraint teachers_id_fkey
  foreign key (id) references app_users(id) on delete cascade;

alter table parents drop constraint parents_id_fkey;
alter table parents add constraint parents_id_fkey
  foreign key (id) references app_users(id) on delete cascade;

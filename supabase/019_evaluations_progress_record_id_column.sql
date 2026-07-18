-- يربط تقييمًا بسجل حفظ محدد (اختياري). السجلات القديمة تبقى بدون تغيير
-- (progress_record_id = NULL) — لا حاجة لأي ترحيل بيانات.
-- unique تضمن علاقة 1:1 (تقييم واحد كحد أقصى لكل سجل حفظ)، مع السماح بأي
-- عدد من القيم NULL (السجلات القديمة غير المرتبطة).

alter table evaluations
  add column progress_record_id uuid references progress_records(id) on delete cascade,
  add constraint evaluations_progress_record_id_unique unique (progress_record_id);

create index idx_evaluations_progress_record_id on evaluations(progress_record_id);

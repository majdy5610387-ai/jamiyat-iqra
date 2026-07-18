import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTeacherDb } from '../../offline/useTeacherDb'
import { addProgress, updateProgress, deleteProgress } from '../../offline/repository'
import type { LocalProgressRecord } from '../../offline/db'
import { SURAHS, getAyahCount, findSurahByName } from '../../constants/quran'
import { RECORD_TYPE_OPTIONS, getRecordTypeLabel } from '../../constants/progressRecordType'

interface TeacherProgressPanelProps {
  studentId: string
  teacherId: string
  deletionPending?: boolean
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

// نسخة Dexie من الجدول الموحّد لسجلات الحفظ والتقييمات، خاصة بلوحة المحفظ
// (تعمل بلا إنترنت). النسخة القابلة لإعادة الاستخدام بوضع القراءة فقط
// (لوحتا المدير وولي الأمر) تبقى ProgressAndEvaluationsPanel كما هي،
// لأنها تتصل بـ Supabase مباشرة ولا تحتاج مصدر بيانات محلي إطلاقًا.
export default function TeacherProgressPanel({
  studentId,
  teacherId,
  deletionPending = false,
}: TeacherProgressPanelProps) {
  const db = useTeacherDb()

  const records = useLiveQuery(
    () =>
      db
        ? db.progressRecords
            .where('student_id')
            .equals(studentId)
            .reverse()
            .sortBy('date')
        : [],
    [db, studentId],
  )

  const [date, setDate] = useState(today())
  const [surah, setSurah] = useState('')
  const [fromAyah, setFromAyah] = useState('')
  const [toAyah, setToAyah] = useState('')
  const [notes, setNotes] = useState('')
  const [recordType, setRecordType] = useState('new')
  const [rating, setRating] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editSurah, setEditSurah] = useState('')
  const [editFromAyah, setEditFromAyah] = useState('')
  const [editToAyah, setEditToAyah] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editRecordType, setEditRecordType] = useState('new')
  const [editRating, setEditRating] = useState(0)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const fromAyahOptions = surah
    ? Array.from({ length: getAyahCount(surah) ?? 0 }, (_, i) => i + 1)
    : []
  const toAyahOptions = fromAyah
    ? fromAyahOptions.filter((n) => n >= Number(fromAyah))
    : fromAyahOptions

  function handleSurahChange(value: string) {
    setSurah(value)
    setFromAyah('')
    setToAyah('')
  }

  function handleFromAyahChange(value: string) {
    setFromAyah(value)
    if (toAyah && Number(toAyah) < Number(value)) setToAyah('')
  }

  // سجل قديم قد يحمل اسم سورة بتهجئة مختلفة عن القائمة الرسمية (مثل "البقره"
  // بدون همزة). editSurahOptions يضيف القيمة الأصلية كخيار احتياطي إن لم
  // تُطابَق (حتى لا "تختفي" من القائمة عند فتح التعديل)، وeditAyahCount
  // يعتمد على عدد آيات القيم الحالية كحد أدنى في هذه الحالة النادرة حتى لا
  // ينكسر نطاق "من/إلى آية".
  const editSurahOptions = SURAHS.some((s) => s.name === editSurah)
    ? SURAHS
    : editSurah
      ? [{ id: 0, name: editSurah, ayahCount: 0 }, ...SURAHS]
      : SURAHS
  const editAyahCount =
    getAyahCount(editSurah) ?? Math.max(Number(editFromAyah) || 0, Number(editToAyah) || 0)
  const editFromAyahOptions = editSurah
    ? Array.from({ length: editAyahCount }, (_, i) => i + 1)
    : []
  const editToAyahOptions = editFromAyah
    ? editFromAyahOptions.filter((n) => n >= Number(editFromAyah))
    : editFromAyahOptions

  function handleEditSurahChange(value: string) {
    setEditSurah(value)
    setEditFromAyah('')
    setEditToAyah('')
  }

  function handleEditFromAyahChange(value: string) {
    setEditFromAyah(value)
    if (editToAyah && Number(editToAyah) < Number(value)) setEditToAyah('')
  }

  function validate(
    dateVal: string,
    surahVal: string,
    fromVal: string,
    toVal: string,
  ): { from: number; to: number } | null {
    const from = Number(fromVal)
    const to = Number(toVal)

    if (!dateVal || !surahVal.trim() || !fromVal || !toVal) {
      setFormError('يرجى تعبئة جميع الحقول الإجبارية')
      return null
    }
    if (!Number.isInteger(from) || from <= 0) {
      setFormError('رقم "من آية" غير صحيح')
      return null
    }
    if (!Number.isInteger(to) || to < from) {
      setFormError('رقم "إلى آية" يجب أن يكون مساويًا لرقم "من آية" أو أكبر منه')
      return null
    }
    return { from, to }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    const validated = validate(date, surah, fromAyah, toAyah)
    if (!validated) return

    setSubmitting(true)
    try {
      await addProgress({
        teacherId,
        studentId,
        date,
        surah: surah.trim(),
        fromAyah: validated.from,
        toAyah: validated.to,
        notes: notes.trim() || null,
        rating: rating > 0 ? rating : null,
        recordType,
      })

      setDate(today())
      setSurah('')
      setFromAyah('')
      setToAyah('')
      setNotes('')
      setRecordType('new')
      setRating(0)
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(record: LocalProgressRecord) {
    setEditingId(record.id)
    setEditDate(record.date)
    // إن كان اسم السورة المخزّن بتهجئة مختلفة عن القائمة الرسمية (مثل "البقره"
    // بدون همزة) نطابقه بالاسم الصحيح تلقائيًا؛ وإلا نُبقيه كما هو (يُضاف
    // كخيار احتياطي بالقائمة عبر editSurahOptions حتى لا تُفقد قيمته الحالية)
    setEditSurah(findSurahByName(record.surah)?.name ?? record.surah)
    setEditFromAyah(String(record.from_ayah))
    setEditToAyah(String(record.to_ayah))
    setEditNotes(record.notes || '')
    setEditRecordType(record.record_type)
    setEditRating(record.rating ?? 0)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(recordId: string) {
    const from = Number(editFromAyah)
    const to = Number(editToAyah)

    if (!editDate || !editSurah.trim() || !editFromAyah || !editToAyah) return
    if (!Number.isInteger(from) || from <= 0 || !Number.isInteger(to) || to < from) return

    setRowBusy(recordId)
    try {
      await updateProgress({
        teacherId,
        progressId: recordId,
        date: editDate,
        surah: editSurah.trim(),
        fromAyah: from,
        toAyah: to,
        notes: editNotes.trim() || null,
        rating: editRating > 0 ? editRating : null,
        recordType: editRecordType,
      })
      setEditingId(null)
    } finally {
      setRowBusy(null)
    }
  }

  async function handleDelete(recordId: string) {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟ سيُحذف التقييم المرتبط به أيضًا إن وُجد.')) {
      return
    }

    setRowBusy(recordId)
    try {
      await deleteProgress(teacherId, recordId)
    } finally {
      setRowBusy(null)
    }
  }

  const loading = records === undefined

  return (
    <section className="section-card">
      <h2>سجلات الحفظ والتقييمات</h2>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : records!.length === 0 ? (
        <p className="empty-state">لا توجد سجلات بعد.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>السورة</th>
              <th>من - إلى آية</th>
              <th>حالة الحفظ</th>
              <th>التقييم</th>
              <th>ملاحظات</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records!.map((record) =>
              editingId === record.id ? (
                <tr key={record.id}>
                  <td>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(event) => setEditDate(event.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={editSurah}
                      onChange={(event) => handleEditSurahChange(event.target.value)}
                    >
                      {editSurahOptions.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.id > 0 ? `${s.id}. ${s.name}` : `${s.name} (قيمة قديمة)`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={editFromAyah}
                      onChange={(event) => handleEditFromAyahChange(event.target.value)}
                      style={{ width: 70 }}
                    >
                      <option value="">من</option>
                      {editFromAyahOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    {' - '}
                    <select
                      value={editToAyah}
                      onChange={(event) => setEditToAyah(event.target.value)}
                      style={{ width: 70 }}
                    >
                      <option value="">إلى</option>
                      {editToAyahOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={editRecordType}
                      onChange={(event) => setEditRecordType(event.target.value)}
                    >
                      {RECORD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={value <= editRating ? 'active' : ''}
                          onClick={() => setEditRating(value === editRating ? 0 : value)}
                        >
                          {value <= editRating ? '★' : '☆'}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(event) => setEditNotes(event.target.value)}
                    />
                  </td>
                  <td>—</td>
                  <td>
                    <button
                      type="button"
                      className="detail-link"
                      disabled={rowBusy === record.id}
                      onClick={() => saveEdit(record.id)}
                    >
                      حفظ
                    </button>
                    {' | '}
                    <button type="button" className="detail-link" onClick={cancelEdit}>
                      إلغاء
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{record.surah}</td>
                  <td>
                    {record.from_ayah} - {record.to_ayah}
                  </td>
                  <td>{getRecordTypeLabel(record.record_type)}</td>
                  <td className="star-display">
                    {record.rating ? renderStars(record.rating) : '—'}
                  </td>
                  <td>{record.notes || '—'}</td>
                  <td>
                    {record.syncStatus === 'synced' && <span title="تمت المزامنة">✅</span>}
                    {record.syncStatus === 'pending' && <span title="بانتظار الاتصال">🕓</span>}
                    {record.syncStatus === 'conflict' && (
                      <span title={record.syncError || 'تعذّرت المزامنة'}>⚠️ تعارض</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="detail-link"
                      onClick={() => startEdit(record)}
                    >
                      تعديل
                    </button>
                    {' | '}
                    <button
                      type="button"
                      className="detail-link"
                      disabled={rowBusy === record.id}
                      onClick={() => handleDelete(record.id)}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {deletionPending ? (
        <p className="form-error">
          هذا الطالب بانتظار الموافقة على حذفه، ولا يمكن إضافة سجل حفظ جديد له حتى يُلغى
          طلب الحذف.
        </p>
      ) : (
      <form className="inline-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="record-date">التاريخ</label>
          <input
            id="record-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="record-surah">السورة</label>
          <select
            id="record-surah"
            value={surah}
            onChange={(event) => handleSurahChange(event.target.value)}
          >
            <option value="">اختر السورة...</option>
            {SURAHS.map((s) => (
              <option key={s.id} value={s.name}>
                {s.id}. {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="record-from-ayah">من آية</label>
          <select
            id="record-from-ayah"
            value={fromAyah}
            disabled={!surah}
            onChange={(event) => handleFromAyahChange(event.target.value)}
          >
            <option value="">—</option>
            {fromAyahOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="record-to-ayah">إلى آية</label>
          <select
            id="record-to-ayah"
            value={toAyah}
            disabled={!surah}
            onChange={(event) => setToAyah(event.target.value)}
          >
            <option value="">—</option>
            {toAyahOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="record-type">حالة الحفظ</label>
          <select
            id="record-type"
            value={recordType}
            onChange={(event) => setRecordType(event.target.value)}
          >
            {RECORD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>التقييم (اختياري)</label>
          <div className="star-rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= rating ? 'active' : ''}
                onClick={() => setRating(value === rating ? 0 : value)}
                aria-label={`${value} من 5`}
              >
                {value <= rating ? '★' : '☆'}
              </button>
            ))}
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="record-notes">ملاحظات (اختياري)</label>
          <input
            id="record-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <button type="submit" className="add-button" disabled={submitting}>
          {submitting ? 'جاري الحفظ...' : 'إضافة سجل حفظ'}
        </button>
        {formError && <p className="form-error">{formError}</p>}
      </form>
      )}
    </section>
  )
}

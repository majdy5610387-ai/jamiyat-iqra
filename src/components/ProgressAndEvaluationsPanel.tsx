import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useSupabaseClient } from '../supabase/useSupabaseClient'
import { TABLES } from '../supabase/tables'
import type { ProgressRecord } from '../types'
import { SURAHS, getAyahCount, findSurahByName } from '../constants/quran'
import { RECORD_TYPE_OPTIONS, getRecordTypeLabel } from '../constants/progressRecordType'

type ProgressWithEvaluation = ProgressRecord & {
  evaluation: { id: string; rating: number; notes: string | null } | null
}

interface ProgressAndEvaluationsPanelProps {
  studentId: string
  readOnly?: boolean
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

export default function ProgressAndEvaluationsPanel({
  studentId,
  readOnly = false,
}: ProgressAndEvaluationsPanelProps) {
  const { customSession } = useAuth()
  const supabase = useSupabaseClient()

  const [records, setRecords] = useState<ProgressWithEvaluation[]>([])
  const [loading, setLoading] = useState(true)

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
  const [rowError, setRowError] = useState<string | null>(null)
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

  async function loadRecords() {
    setLoading(true)
    const { data, error } = await supabase
      .from(TABLES.progressRecords)
      .select('*, evaluation:evaluations(id, rating, notes)')
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error) setRecords((data as unknown as ProgressWithEvaluation[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  function validateFields(
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

    const validated = validateFields(date, surah, fromAyah, toAyah)
    if (!validated) return

    if (!customSession) {
      setFormError('تعذّر تحديد بيانات المحفظ الحالي، حاول تسجيل الخروج والدخول من جديد')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('add_progress_with_evaluation', {
        p_progress_id: crypto.randomUUID(),
        p_student_id: studentId,
        p_teacher_id: customSession.sub,
        p_date: date,
        p_surah: surah.trim(),
        p_from_ayah: validated.from,
        p_to_ayah: validated.to,
        p_notes: notes.trim() || null,
        p_rating: rating > 0 ? rating : null,
        p_record_type: recordType,
      })

      if (error) {
        setFormError('تعذّر حفظ السجل: ' + error.message)
        return
      }

      setDate(today())
      setSurah('')
      setFromAyah('')
      setToAyah('')
      setNotes('')
      setRecordType('new')
      setRating(0)
      await loadRecords()
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(record: ProgressWithEvaluation) {
    setRowError(null)
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
    setEditRating(record.evaluation?.rating ?? 0)
  }

  function cancelEdit() {
    setEditingId(null)
    setRowError(null)
  }

  async function saveEdit(recordId: string) {
    const from = Number(editFromAyah)
    const to = Number(editToAyah)

    if (!editDate || !editSurah.trim() || !editFromAyah || !editToAyah) {
      setRowError('يرجى تعبئة جميع الحقول الإجبارية')
      return
    }
    if (!Number.isInteger(from) || from <= 0 || !Number.isInteger(to) || to < from) {
      setRowError('أرقام الآيات غير صحيحة')
      return
    }

    setRowBusy(recordId)
    try {
      const { error } = await supabase.rpc('update_progress_with_evaluation', {
        p_progress_id: recordId,
        p_date: editDate,
        p_surah: editSurah.trim(),
        p_from_ayah: from,
        p_to_ayah: to,
        p_notes: editNotes.trim() || null,
        p_rating: editRating > 0 ? editRating : null,
        p_record_type: editRecordType,
      })

      if (error) {
        setRowError('تعذّر حفظ التعديل: ' + error.message)
        return
      }

      setEditingId(null)
      await loadRecords()
    } finally {
      setRowBusy(null)
    }
  }

  async function handleDelete(recordId: string) {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟ سيُحذف التقييم المرتبط به أيضًا إن وُجد.')) {
      return
    }

    setRowError(null)
    setRowBusy(recordId)
    try {
      const { error } = await supabase.from(TABLES.progressRecords).delete().eq('id', recordId)

      if (error) {
        setRowError('تعذّر حذف السجل: ' + error.message)
        return
      }

      await loadRecords()
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <section className="section-card">
      <h2>سجلات الحفظ والتقييمات</h2>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : records.length === 0 ? (
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
              {!readOnly && <th></th>}
            </tr>
          </thead>
          <tbody>
            {records.map((record) =>
              !readOnly && editingId === record.id ? (
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
                    {record.evaluation ? renderStars(record.evaluation.rating) : '—'}
                  </td>
                  <td>{record.notes || '—'}</td>
                  {!readOnly && (
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
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {!readOnly && editingId === null && rowError && <p className="form-error">{rowError}</p>}

      {!readOnly && (
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

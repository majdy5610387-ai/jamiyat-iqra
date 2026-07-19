import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'
import { useAuth } from '../../auth/AuthContext'
import type { Center, Teacher } from '../../types'
import { isValidNationalId, sanitizeNationalIdInput, NATIONAL_ID_ERROR_MESSAGE } from '../../utils/nationalId'

type TeacherWithCenter = Teacher & { center: { name: string } | null }

export default function TeachersSection() {
  const { isSuperAdmin } = useAuth()
  const [teachers, setTeachers] = useState<TeacherWithCenter[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [loading, setLoading] = useState(true)

  const [fullName, setFullName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [phone, setPhone] = useState('')
  const [centerId, setCenterId] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCenterId, setEditCenterId] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [transferNewCenterId, setTransferNewCenterId] = useState('')
  const [transferNewTeacherId, setTransferNewTeacherId] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const [teachersRes, centersRes] = await Promise.all([
      supabase
        .from(TABLES.teachers)
        .select('*, center:centers(name)')
        .order('created_at', { ascending: false }),
      supabase.from(TABLES.centers).select('*').order('name'),
    ])

    if (!teachersRes.error) setTeachers((teachersRes.data as TeacherWithCenter[]) ?? [])
    if (!centersRes.error) setCenters((centersRes.data as Center[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (!fullName.trim() || !nationalId.trim() || !centerId || !password) {
      setFormError('يرجى تعبئة جميع الحقول الإجبارية')
      return
    }
    if (!isValidNationalId(nationalId.trim())) {
      setFormError(NATIONAL_ID_ERROR_MESSAGE)
      return
    }
    if (password.length < 6) {
      setFormError('كلمة المرور يجب ألا تقل عن 6 أحرف/أرقام')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('create_teacher_account', {
        p_national_id: nationalId.trim(),
        p_password: password,
        p_full_name: fullName.trim(),
        p_phone: phone.trim() || null,
        p_center_id: centerId,
      })

      if (error) {
        const message = error.message.includes('duplicate')
          ? 'رقم الهوية هذا مستخدم مسبقًا لمحفظ آخر'
          : error.message
        setFormError('تعذّر إنشاء حساب المحفظ: ' + message)
        return
      }

      setFullName('')
      setNationalId('')
      setPhone('')
      setCenterId('')
      setPassword('')
      await loadData()
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(teacher: TeacherWithCenter) {
    setRowError(null)
    setTransferringId(null)
    setEditingId(teacher.id)
    setEditFullName(teacher.full_name)
    setEditPhone(teacher.phone || '')
    setEditCenterId(teacher.center_id)
  }

  function cancelEdit() {
    setEditingId(null)
    setRowError(null)
  }

  async function saveEdit(teacherId: string) {
    if (!editFullName.trim() || !editCenterId) {
      setRowError('يرجى تعبئة الاسم والمركز')
      return
    }

    setRowBusy(teacherId)
    try {
      const { error } = await supabase
        .from(TABLES.teachers)
        .update({
          full_name: editFullName.trim(),
          phone: editPhone.trim() || null,
          center_id: editCenterId,
        })
        .eq('id', teacherId)

      if (error) {
        setRowError('تعذّر حفظ التعديل: ' + error.message)
        return
      }

      setEditingId(null)
      await loadData()
    } finally {
      setRowBusy(null)
    }
  }

  function startReset(teacherId: string) {
    setResetError(null)
    setResetSuccess(null)
    setEditingId(null)
    setTransferringId(null)
    setResettingId(teacherId)
    setResetPassword('')
  }

  function cancelReset() {
    setResettingId(null)
    setResetError(null)
  }

  function startTransfer(teacher: TeacherWithCenter) {
    setTransferError(null)
    setTransferSuccess(null)
    setEditingId(null)
    setResettingId(null)
    setTransferringId(teacher.id)
    setTransferNewCenterId(teacher.center_id)
    setTransferNewTeacherId('')
  }

  function cancelTransfer() {
    setTransferringId(null)
    setTransferError(null)
  }

  function handleTransferCenterChange(centerId: string) {
    setTransferNewCenterId(centerId)
    setTransferNewTeacherId('')
  }

  async function confirmTransfer(oldTeacherId: string) {
    setTransferError(null)

    if (!transferNewCenterId || !transferNewTeacherId) {
      setTransferError('يرجى اختيار المركز والمحفظ الجديدين')
      return
    }

    setRowBusy(oldTeacherId)
    try {
      const { data, error } = await supabase.rpc('transfer_teacher_students', {
        p_old_teacher_id: oldTeacherId,
        p_new_center_id: transferNewCenterId,
        p_new_teacher_id: transferNewTeacherId,
      })

      if (error) {
        setTransferError('تعذّر نقل الطلاب: ' + error.message)
        return
      }

      setTransferringId(null)
      setTransferSuccess(`تم نقل ${data as number} طالبًا بنجاح.`)
      await loadData()
    } finally {
      setRowBusy(null)
    }
  }

  async function confirmReset(teacherId: string) {
    setResetError(null)

    if (resetPassword.length < 6) {
      setResetError('كلمة المرور يجب ألا تقل عن 6 أحرف/أرقام')
      return
    }

    setRowBusy(teacherId)
    try {
      const { error } = await supabase.rpc('reset_teacher_password', {
        p_teacher_id: teacherId,
        p_new_password: resetPassword,
      })

      if (error) {
        setResetError('تعذّر إعادة تعيين كلمة المرور: ' + error.message)
        return
      }

      setResettingId(null)
      setResetSuccess(
        'تم تغيير كلمة المرور بنجاح — لا تنسَ إخبار المحفظ بكلمة المرور الجديدة يدويًا (لا يوجد بريد فعلي لإرسالها تلقائيًا).',
      )
    } finally {
      setRowBusy(null)
    }
  }

  async function handleDelete(teacherId: string) {
    if (!window.confirm('هل أنت متأكد من حذف هذا المحفظ؟')) return

    setRowError(null)
    setRowBusy(teacherId)
    try {
      const { error } = await supabase.rpc('delete_teacher', { p_teacher_id: teacherId })

      if (error) {
        if (error.code === '23503') {
          setRowError('لا يمكن حذف هذا المحفظ لأن لديه طلابًا مسجّلين — انقل الطلاب لمحفظ آخر أولًا')
        } else {
          setRowError('تعذّر حذف المحفظ: ' + error.message)
        }
        return
      }

      await loadData()
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <section className="section-card">
      <h2>المحفظون</h2>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : teachers.length === 0 ? (
        <p className="empty-state">لا يوجد محفظون بعد.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>رقم الهوية</th>
              <th>الهاتف</th>
              <th>المركز</th>
              {isSuperAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) =>
              resettingId === teacher.id ? (
                <tr key={teacher.id}>
                  <td colSpan={3}>
                    <div className="form-field">
                      <label htmlFor={`reset-password-${teacher.id}`}>
                        كلمة مرور جديدة لـ {teacher.full_name}
                      </label>
                      <input
                        id={`reset-password-${teacher.id}`}
                        type="text"
                        value={resetPassword}
                        onChange={(event) => setResetPassword(event.target.value)}
                      />
                    </div>
                    {resetError && <p className="form-error">{resetError}</p>}
                  </td>
                  <td data-label="المركز">{teacher.center?.name || '—'}</td>
                  <td className="data-table-actions">
                    <button
                      type="button"
                      className="detail-link"
                      disabled={rowBusy === teacher.id}
                      onClick={() => confirmReset(teacher.id)}
                    >
                      تأكيد
                    </button>
                    {' | '}
                    <button type="button" className="detail-link" onClick={cancelReset}>
                      إلغاء
                    </button>
                  </td>
                </tr>
              ) : editingId === teacher.id ? (
                <tr key={teacher.id}>
                  <td data-label="الاسم">
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(event) => setEditFullName(event.target.value)}
                    />
                  </td>
                  <td data-label="رقم الهوية">{teacher.national_id}</td>
                  <td data-label="الهاتف">
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                    />
                  </td>
                  <td data-label="المركز">
                    <select
                      value={editCenterId}
                      onChange={(event) => setEditCenterId(event.target.value)}
                    >
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="data-table-actions">
                    <button
                      type="button"
                      className="detail-link"
                      disabled={rowBusy === teacher.id}
                      onClick={() => saveEdit(teacher.id)}
                    >
                      حفظ
                    </button>
                    {' | '}
                    <button type="button" className="detail-link" onClick={cancelEdit}>
                      إلغاء
                    </button>
                    {rowError && <p className="form-error">{rowError}</p>}
                  </td>
                </tr>
              ) : transferringId === teacher.id ? (
                <tr key={teacher.id}>
                  <td colSpan={2}>
                    نقل كل طلاب {teacher.full_name} إلى:
                    {transferError && <p className="form-error">{transferError}</p>}
                  </td>
                  <td data-label="المركز الجديد">
                    <select
                      value={transferNewCenterId}
                      onChange={(event) => handleTransferCenterChange(event.target.value)}
                    >
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="المحفظ الجديد">
                    <select
                      value={transferNewTeacherId}
                      onChange={(event) => setTransferNewTeacherId(event.target.value)}
                    >
                      <option value="">اختر محفظًا...</option>
                      {teachers
                        .filter((t) => t.center_id === transferNewCenterId && t.id !== teacher.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="data-table-actions">
                    <button
                      type="button"
                      className="detail-link"
                      disabled={rowBusy === teacher.id}
                      onClick={() => confirmTransfer(teacher.id)}
                    >
                      تأكيد النقل
                    </button>
                    {' | '}
                    <button type="button" className="detail-link" onClick={cancelTransfer}>
                      إلغاء
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={teacher.id}>
                  <td data-label="الاسم">{teacher.full_name}</td>
                  <td data-label="رقم الهوية">{teacher.national_id}</td>
                  <td data-label="الهاتف">{teacher.phone || '—'}</td>
                  <td data-label="المركز">{teacher.center?.name || '—'}</td>
                  {isSuperAdmin && (
                    <td className="data-table-actions">
                      <button
                        type="button"
                        className="detail-link"
                        onClick={() => startEdit(teacher)}
                      >
                        تعديل
                      </button>
                      {' | '}
                      <button
                        type="button"
                        className="detail-link"
                        onClick={() => startReset(teacher.id)}
                      >
                        إعادة تعيين كلمة المرور
                      </button>
                      {' | '}
                      <button
                        type="button"
                        className="detail-link"
                        onClick={() => startTransfer(teacher)}
                      >
                        نقل كل الطلاب
                      </button>
                      {' | '}
                      <button
                        type="button"
                        className="detail-link"
                        disabled={rowBusy === teacher.id}
                        onClick={() => handleDelete(teacher.id)}
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

      {editingId === null && rowError && <p className="form-error">{rowError}</p>}
      {resetSuccess && <p className="form-success">{resetSuccess}</p>}
      {transferSuccess && <p className="form-success">{transferSuccess}</p>}

      {isSuperAdmin && (
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="teacher-name">الاسم الكامل</label>
            <input
              id="teacher-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="teacher-national-id">رقم الهوية</label>
            <input
              id="teacher-national-id"
              type="text"
              inputMode="numeric"
              maxLength={9}
              value={nationalId}
              onChange={(event) => setNationalId(sanitizeNationalIdInput(event.target.value))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="teacher-phone">رقم التواصل</label>
            <input
              id="teacher-phone"
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="teacher-center">المركز</label>
            <select
              id="teacher-center"
              value={centerId}
              onChange={(event) => setCenterId(event.target.value)}
            >
              <option value="">اختر مركزًا</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="teacher-password">كلمة المرور</label>
            <input
              id="teacher-password"
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className="add-button" disabled={submitting}>
            {submitting ? 'جاري الإضافة...' : 'إضافة محفظ'}
          </button>
          {formError && <p className="form-error">{formError}</p>}
        </form>
      )}
    </section>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'
import { useAuth } from '../../auth/AuthContext'
import { getStudentFullName, type Center, type Student, type Teacher } from '../../types'

type StudentWithRelations = Student & {
  center: { name: string } | null
  teacher: { full_name: string } | null
}

export default function StudentsManagementSection() {
  const { isSuperAdmin } = useAuth()
  const [students, setStudents] = useState<StudentWithRelations[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editFatherName, setEditFatherName] = useState('')
  const [editGrandfatherName, setEditGrandfatherName] = useState('')
  const [editFamilyName, setEditFamilyName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [transferCenterId, setTransferCenterId] = useState('')
  const [transferTeacherId, setTransferTeacherId] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const [studentsRes, centersRes, teachersRes] = await Promise.all([
      supabase
        .from(TABLES.students)
        .select('*, center:centers(name), teacher:teachers!teacher_id(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from(TABLES.centers).select('*').order('name'),
      supabase.from(TABLES.teachers).select('*').order('full_name'),
    ])

    if (!studentsRes.error) setStudents((studentsRes.data as StudentWithRelations[]) ?? [])
    if (!centersRes.error) setCenters((centersRes.data as Center[]) ?? [])
    if (!teachersRes.error) setTeachers((teachersRes.data as Teacher[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function startEdit(student: StudentWithRelations) {
    setRowError(null)
    setTransferringId(null)
    setEditingId(student.id)
    setEditFirstName(student.first_name)
    setEditFatherName(student.father_name)
    setEditGrandfatherName(student.grandfather_name)
    setEditFamilyName(student.family_name)
    setEditPhone(student.phone)
  }

  function cancelEdit() {
    setEditingId(null)
    setRowError(null)
  }

  function startTransfer(student: StudentWithRelations) {
    setRowError(null)
    setTransferError(null)
    setEditingId(null)
    setTransferringId(student.id)
    setTransferCenterId(student.center_id)
    setTransferTeacherId(student.teacher_id)
  }

  function cancelTransfer() {
    setTransferringId(null)
    setTransferError(null)
  }

  function handleTransferCenterChange(centerId: string) {
    setTransferCenterId(centerId)
    setTransferTeacherId('')
  }

  async function confirmTransfer(studentId: string) {
    setTransferError(null)

    if (!transferCenterId || !transferTeacherId) {
      setTransferError('يرجى اختيار المركز والمحفظ الجديدين')
      return
    }

    setRowBusy(studentId)
    try {
      const { error } = await supabase.rpc('transfer_student', {
        p_student_id: studentId,
        p_new_center_id: transferCenterId,
        p_new_teacher_id: transferTeacherId,
      })

      if (error) {
        setTransferError('تعذّر نقل الطالب: ' + error.message)
        return
      }

      setTransferringId(null)
      await loadData()
    } finally {
      setRowBusy(null)
    }
  }

  async function saveEdit(studentId: string) {
    if (
      !editFirstName.trim() ||
      !editFatherName.trim() ||
      !editGrandfatherName.trim() ||
      !editFamilyName.trim() ||
      !editPhone.trim()
    ) {
      setRowError('يرجى تعبئة جميع الحقول')
      return
    }

    setRowBusy(studentId)
    try {
      const { error } = await supabase
        .from(TABLES.students)
        .update({
          first_name: editFirstName.trim(),
          father_name: editFatherName.trim(),
          grandfather_name: editGrandfatherName.trim(),
          family_name: editFamilyName.trim(),
          phone: editPhone.trim(),
        })
        .eq('id', studentId)

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

  async function handleDelete(studentId: string) {
    if (
      !window.confirm(
        'هل أنت متأكد من حذف هذا الطالب؟ سيؤدي هذا لحذف سجلات حفظه وتقييماته وحساب ولي أمره نهائيًا.',
      )
    ) {
      return
    }

    setRowError(null)
    setRowBusy(studentId)
    try {
      const { error } = await supabase.rpc('delete_student', { p_student_id: studentId })

      if (error) {
        setRowError('تعذّر حذف الطالب: ' + error.message)
        return
      }

      await loadData()
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <section className="section-card">
      <h2>الطلاب</h2>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : students.length === 0 ? (
        <p className="empty-state">لا يوجد طلاب بعد.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>الاسم الرباعي</th>
              <th>رقم الهوية</th>
              <th>المركز</th>
              <th>المحفظ</th>
              {isSuperAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {students.map((student) =>
              editingId === student.id ? (
                <tr key={student.id}>
                  <td data-label="الاسم الرباعي">
                    <div className="form-field">
                      <input
                        type="text"
                        placeholder="الاسم الأول"
                        value={editFirstName}
                        onChange={(event) => setEditFirstName(event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="اسم الأب"
                        value={editFatherName}
                        onChange={(event) => setEditFatherName(event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="اسم الجد"
                        value={editGrandfatherName}
                        onChange={(event) => setEditGrandfatherName(event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="اسم العائلة"
                        value={editFamilyName}
                        onChange={(event) => setEditFamilyName(event.target.value)}
                      />
                    </div>
                  </td>
                  <td data-label="رقم الهوية">{student.national_id}</td>
                  <td data-label="المركز">{student.center?.name || '—'}</td>
                  <td data-label="الهاتف">
                    <input
                      type="text"
                      placeholder="رقم التواصل"
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                    />
                  </td>
                  <td className="data-table-actions">
                    <button
                      type="button"
                      className="detail-link"
                      disabled={rowBusy === student.id}
                      onClick={() => saveEdit(student.id)}
                    >
                      حفظ
                    </button>
                    {' | '}
                    <button type="button" className="detail-link" onClick={cancelEdit}>
                      إلغاء
                    </button>
                  </td>
                </tr>
              ) : transferringId === student.id ? (
                <tr key={student.id}>
                  <td colSpan={2}>
                    نقل {getStudentFullName(student)} إلى:
                    {transferError && <p className="form-error">{transferError}</p>}
                  </td>
                  <td data-label="المركز الجديد">
                    <select
                      value={transferCenterId}
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
                      value={transferTeacherId}
                      onChange={(event) => setTransferTeacherId(event.target.value)}
                    >
                      <option value="">اختر محفظًا...</option>
                      {teachers
                        .filter((t) => t.center_id === transferCenterId)
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
                      disabled={rowBusy === student.id}
                      onClick={() => confirmTransfer(student.id)}
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
                <tr key={student.id}>
                  <td data-label="الاسم الرباعي">
                    {getStudentFullName(student)}
                    {student.deletion_requested_at && (
                      <span title="بانتظار موافقة السوبر أدمن على الحذف"> ⏳</span>
                    )}
                  </td>
                  <td data-label="رقم الهوية">{student.national_id}</td>
                  <td data-label="المركز">{student.center?.name || '—'}</td>
                  <td data-label="المحفظ">{student.teacher?.full_name || '—'}</td>
                  {isSuperAdmin && (
                    <td className="data-table-actions">
                      <button
                        type="button"
                        className="detail-link"
                        onClick={() => startEdit(student)}
                      >
                        تعديل
                      </button>
                      {' | '}
                      <button
                        type="button"
                        className="detail-link"
                        disabled={!!student.deletion_requested_at}
                        title={
                          student.deletion_requested_at
                            ? 'لا يمكن النقل أثناء وجود طلب حذف معلّق'
                            : undefined
                        }
                        onClick={() => startTransfer(student)}
                      >
                        نقل
                      </button>
                      {' | '}
                      <button
                        type="button"
                        className="detail-link"
                        disabled={rowBusy === student.id}
                        onClick={() => handleDelete(student.id)}
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

      {rowError && <p className="form-error">{rowError}</p>}
    </section>
  )
}

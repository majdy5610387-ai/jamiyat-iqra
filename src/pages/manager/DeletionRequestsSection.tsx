import { useEffect, useState } from 'react'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'
import { getStudentFullName, type Student } from '../../types'

type StudentWithTeacher = Student & { teacher: { full_name: string } | null }

// يظهر فقط لسوبر أدمن (يُربَط بهذا الشرط في ManagerDashboard)، وفقط عند
// وجود طلبات حذف معلّقة فعليًا — بدون ذلك لا داعي لإظهار قسم فارغ دائمًا.
export default function DeletionRequestsSection() {
  const [requests, setRequests] = useState<StudentWithTeacher[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  async function loadRequests() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from(TABLES.students)
      .select('*, teacher:teachers!teacher_id(full_name)')
      .not('deletion_requested_at', 'is', null)
      .order('deletion_requested_at', { ascending: true })

    if (error) {
      setLoadError(error.message)
    } else {
      setRequests((data as StudentWithTeacher[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadRequests()
  }, [])

  async function handleApprove(studentId: string) {
    if (
      !window.confirm(
        'هل أنت متأكد من الموافقة على حذف هذا الطالب؟ سيُحذف نهائيًا مع كل سجلات حفظه وتقييماته وحساب ولي أمره، ولا يمكن التراجع.',
      )
    ) {
      return
    }

    setRowError(null)
    setRowBusy(studentId)
    try {
      const { error } = await supabase.rpc('delete_student', { p_student_id: studentId })

      if (error) {
        setRowError('تعذّرت الموافقة على الحذف: ' + error.message)
        return
      }

      await loadRequests()
    } finally {
      setRowBusy(null)
    }
  }

  async function handleReject(studentId: string) {
    if (!window.confirm('هل تريد رفض طلب الحذف؟ سيعود الطالب لحالته الطبيعية كأن الطلب لم يحدث.')) {
      return
    }

    setRowError(null)
    setRowBusy(studentId)
    try {
      const { error } = await supabase.rpc('cancel_student_deletion_request', {
        p_student_id: studentId,
      })

      if (error) {
        setRowError('تعذّر رفض الطلب: ' + error.message)
        return
      }

      await loadRequests()
    } finally {
      setRowBusy(null)
    }
  }

  if (loading) {
    return null
  }

  if (loadError) {
    return (
      <section className="section-card">
        <h2>⏳ طلبات حذف بانتظار الموافقة</h2>
        <p className="form-error">تعذّر جلب طلبات الحذف: {loadError}</p>
      </section>
    )
  }

  if (requests.length === 0) {
    return null
  }

  return (
    <section className="section-card">
      <h2>⏳ طلبات حذف بانتظار الموافقة ({requests.length})</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>الطالب</th>
            <th>رقم الهوية</th>
            <th>المحفظ الطالب للطلب</th>
            <th>تاريخ الطلب</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((student) => (
            <tr key={student.id}>
              <td>{getStudentFullName(student)}</td>
              <td>{student.national_id}</td>
              <td>{student.teacher?.full_name || '—'}</td>
              <td>
                {student.deletion_requested_at
                  ? new Date(student.deletion_requested_at).toLocaleString('ar')
                  : '—'}
              </td>
              <td>
                <button
                  type="button"
                  className="detail-link"
                  disabled={rowBusy === student.id}
                  onClick={() => handleApprove(student.id)}
                >
                  موافقة على الحذف
                </button>
                {' | '}
                <button
                  type="button"
                  className="detail-link"
                  disabled={rowBusy === student.id}
                  onClick={() => handleReject(student.id)}
                >
                  رفض الطلب
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rowError && <p className="form-error">{rowError}</p>}
    </section>
  )
}

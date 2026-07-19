import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'
import { getStudentFullName, type Student } from '../../types'
import ProgressAndEvaluationsPanel from '../../components/ProgressAndEvaluationsPanel'
import '../../styles/dashboard.css'

type StudentWithRelations = Student & {
  center: { name: string } | null
  teacher: { full_name: string } | null
}

export default function ManagerStudentDetail() {
  const { studentId } = useParams<{ studentId: string }>()

  const [student, setStudent] = useState<StudentWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    supabase
      .from(TABLES.students)
      .select('*, center:centers(name), teacher:teachers!teacher_id(full_name)')
      .eq('id', studentId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setLoadError(error.message)
        } else {
          setStudent((data as StudentWithRelations) ?? null)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [studentId])

  if (!studentId) {
    return null
  }

  return (
    <div className="dashboard-page">
      <Link className="back-link-button" to="/manager/centers">
        ← الرجوع للمراكز
      </Link>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : loadError ? (
        <p className="form-error">تعذّر جلب بيانات الطالب: {loadError}</p>
      ) : !student ? (
        <p className="empty-state">تعذّر إيجاد هذا الطالب.</p>
      ) : (
        <>
          <div className="student-detail-header">
            <h1>{getStudentFullName(student)}</h1>
            {student.deletion_requested_at && (
              <p className="form-error">⏳ بانتظار موافقة السوبر أدمن على حذف هذا الطالب</p>
            )}
            <p>رقم الهوية: {student.national_id}</p>
            <p>تاريخ الميلاد: {student.birth_date}</p>
            <p>رقم التواصل: {student.phone}</p>
            <p>المركز: {student.center?.name || '—'}</p>
            <p>المحفظ: {student.teacher?.full_name || '—'}</p>
          </div>

          <ProgressAndEvaluationsPanel studentId={studentId} readOnly />
        </>
      )}
    </div>
  )
}

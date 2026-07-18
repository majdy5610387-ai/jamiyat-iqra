import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useSupabaseClient } from '../../supabase/useSupabaseClient'
import { TABLES } from '../../supabase/tables'
import { getStudentFullName, type Student } from '../../types'
import Logo from '../../components/Logo'
import ProgressAndEvaluationsPanel from '../../components/ProgressAndEvaluationsPanel'
import HonorBoardPanel from './HonorBoardPanel'
import '../../styles/dashboard.css'

type StudentWithRelations = Student & {
  center: { name: string } | null
  teacher: { full_name: string } | null
}

export default function ParentDashboard() {
  const { signOut } = useAuth()
  const supabase = useSupabaseClient()
  const navigate = useNavigate()

  const [student, setStudent] = useState<StudentWithRelations | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // بدون أي شرط WHERE — RLS ("parents read own child") تُرجع تلقائيًا
    // طالب ولي الأمر الحالي فقط، ولا يمكن الوصول لأي طالب آخر إطلاقًا.
    supabase
      .from(TABLES.students)
      .select('*, center:centers(name), teacher:teachers!teacher_id(full_name)')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setStudent((data as StudentWithRelations) ?? null)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-header-title">
          <Logo size={44} />
          <div>
            <h1>متابعة ولي الأمر</h1>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="logout-button" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : !student ? (
        <p className="empty-state">تعذّر إيجاد بيانات الطالب المرتبط بحسابك.</p>
      ) : (
        <>
          <div className="student-detail-header">
            <h1>{getStudentFullName(student)}</h1>
            <p>رقم الهوية: {student.national_id}</p>
            <p>تاريخ الميلاد: {student.birth_date}</p>
            <p>المركز: {student.center?.name || '—'}</p>
            <p>المحفظ: {student.teacher?.full_name || '—'}</p>
          </div>

          <ProgressAndEvaluationsPanel studentId={student.id} readOnly />
          <HonorBoardPanel />
        </>
      )}
    </div>
  )
}

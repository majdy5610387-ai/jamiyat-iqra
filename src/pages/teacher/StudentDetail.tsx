import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../../auth/AuthContext'
import { useTeacherDb } from '../../offline/useTeacherDb'
import { getLocalStudentFullName } from '../../offline/helpers'
import TeacherProgressPanel from './TeacherProgressPanel'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import '../../styles/dashboard.css'

export default function StudentDetail() {
  const { studentId } = useParams<{ studentId: string }>()
  const { customSession } = useAuth()
  const db = useTeacherDb()

  const student = useLiveQuery(
    () => (db && studentId ? db.students.get(studentId) : undefined),
    [db, studentId],
  )

  if (!studentId || !customSession) {
    return null
  }

  const loading = student === undefined

  return (
    <div className="dashboard-page">
      <Link className="back-link-button" to="/teacher">
        ← الرجوع للطلاب
      </Link>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : !student ? (
        <p className="empty-state">تعذّر إيجاد هذا الطالب.</p>
      ) : (
        <>
          <div className="student-detail-header">
            <h1>{getLocalStudentFullName(student)}</h1>
            <p>رقم الهوية: {student.national_id}</p>
            {student.deletion_requested_at && (
              <p className="form-error">⏳ بانتظار موافقة السوبر أدمن على حذف هذا الطالب</p>
            )}
          </div>

          <ErrorBoundary>
            <TeacherProgressPanel
              studentId={studentId}
              teacherId={customSession.sub}
              deletionPending={!!student.deletion_requested_at}
            />
          </ErrorBoundary>
        </>
      )}
    </div>
  )
}

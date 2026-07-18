import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { pullLatestData } from '../../offline/pull'
import Logo from '../../components/Logo'
import StudentsSection from './StudentsSection'
import HonorBoardSection from './HonorBoardSection'
import SyncIssuesPanel from '../../components/SyncIssuesPanel'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import '../../styles/dashboard.css'

export default function TeacherDashboard() {
  const { customSession, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // سحب أولي عند فتح اللوحة (يعمل بصمت لو غير متصل — الواجهة أصلًا تقرأ
    // من Dexie، فلا تعتمد على نجاح هذا الاستدعاء لتعمل).
    if (customSession) {
      void pullLatestData(customSession.sub)
    }
  }, [customSession])

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
            <h1>لوحة المحفظ</h1>
            <p>إدارة طلاب مركزك</p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="logout-button" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </div>
      </div>

      <ErrorBoundary>
        <SyncIssuesPanel />
      </ErrorBoundary>
      <ErrorBoundary>
        <StudentsSection />
      </ErrorBoundary>
      <ErrorBoundary>
        <HonorBoardSection />
      </ErrorBoundary>
    </div>
  )
}

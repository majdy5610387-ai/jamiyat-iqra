import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Logo from '../../components/Logo'
import CentersSection from './CentersSection'
import TeachersSection from './TeachersSection'
import StudentsManagementSection from './StudentsManagementSection'
import ManagersSection from './ManagersSection'
import ExcelExportButton from './ExcelExportButton'
import BackupRestoreSection from './BackupRestoreSection'
import DeletionRequestsSection from './DeletionRequestsSection'
import '../../styles/dashboard.css'

export default function ManagerDashboard() {
  const { managerUser, isSuperAdmin, signOut } = useAuth()
  const navigate = useNavigate()

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
            <h1>لوحة المدير</h1>
            <p>مسجّل دخول باسم: {managerUser?.email}</p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <ExcelExportButton />
          <button type="button" className="logout-button" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </div>
      </div>

      {isSuperAdmin && <DeletionRequestsSection />}
      <CentersSection />
      <TeachersSection />
      <StudentsManagementSection />
      {isSuperAdmin && <ManagersSection />}
      {isSuperAdmin && <BackupRestoreSection />}
    </div>
  )
}

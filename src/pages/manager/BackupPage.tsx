import ManagerSectionPage from './ManagerSectionPage'
import BackupRestoreSection from './BackupRestoreSection'

export default function BackupPage() {
  return (
    <ManagerSectionPage title="النسخ الاحتياطي والاستعادة" requireSuperAdmin>
      <BackupRestoreSection />
    </ManagerSectionPage>
  )
}

import ManagerSectionPage from './ManagerSectionPage'
import DeletionRequestsSection from './DeletionRequestsSection'

export default function DeletionRequestsPage() {
  return (
    <ManagerSectionPage title="طلبات حذف بانتظار الموافقة" requireSuperAdmin>
      <DeletionRequestsSection />
    </ManagerSectionPage>
  )
}

import ManagerSectionPage from './ManagerSectionPage'
import ManagersSection from './ManagersSection'

export default function ManagersPage() {
  return (
    <ManagerSectionPage title="المدراء" requireSuperAdmin>
      <ManagersSection />
    </ManagerSectionPage>
  )
}

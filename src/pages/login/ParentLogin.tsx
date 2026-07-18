import { useNavigate } from 'react-router-dom'
import { loginWithCustomAuth } from '../../auth/customAuth'
import { useAuth } from '../../auth/AuthContext'
import RoleLoginForm from '../../components/RoleLoginForm'

export default function ParentLogin() {
  const navigate = useNavigate()
  const { refreshCustomSession } = useAuth()

  async function handleSubmit(nationalId: string, password: string) {
    await loginWithCustomAuth(nationalId, password, 'parent')
    refreshCustomSession()
    navigate('/parent')
  }

  return (
    <RoleLoginForm
      title="دخول ولي الأمر"
      identifierLabel="رقم هوية الطالب"
      onSubmit={handleSubmit}
    />
  )
}

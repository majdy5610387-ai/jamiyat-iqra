import { useNavigate } from 'react-router-dom'
import { loginWithCustomAuth } from '../../auth/customAuth'
import { useAuth } from '../../auth/AuthContext'
import RoleLoginForm from '../../components/RoleLoginForm'

export default function TeacherLogin() {
  const navigate = useNavigate()
  const { refreshCustomSession } = useAuth()

  async function handleSubmit(nationalId: string, password: string) {
    await loginWithCustomAuth(nationalId, password, 'teacher')
    refreshCustomSession()
    navigate('/teacher')
  }

  return (
    <RoleLoginForm
      title="دخول المحفظ"
      identifierLabel="رقم الهوية"
      onSubmit={handleSubmit}
    />
  )
}

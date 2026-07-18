import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import RoleLoginForm from '../../components/RoleLoginForm'

export default function ManagerLogin() {
  const navigate = useNavigate()

  async function handleSubmit(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    navigate('/manager')
  }

  return (
    <RoleLoginForm
      title="دخول المدير"
      identifierLabel="البريد الإلكتروني"
      identifierType="email"
      onSubmit={handleSubmit}
    />
  )
}

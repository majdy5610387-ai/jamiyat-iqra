import { Navigate, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import { useAuth } from '../../auth/AuthContext'
import './Login.css'

const ROLE_OPTIONS = [
  { path: '/login/manager', label: 'دخول المدير', variant: 'manager' },
  { path: '/login/teacher', label: 'دخول المحفظ', variant: 'teacher' },
  { path: '/login/parent', label: 'دخول ولي الأمر', variant: 'parent' },
]

const DASHBOARD_PATH_BY_ROLE = {
  manager: '/manager',
  teacher: '/teacher',
  parent: '/parent',
}

export default function LoginSelect() {
  const navigate = useNavigate()
  const { loading, role } = useAuth()

  // TWA يُطلق دائمًا على "/" بغض النظر عن آخر صفحة كان يستخدمها المستخدم
  // (خلافًا لمتصفح عادي يستعيد آخر تبويب) — فبدون هذا التحقق، يظهر اختيار
  // الدور دائمًا حتى لو كانت الجلسة المحفوظة صالحة تمامًا، وكأن المستخدم
  // سُجِّل خروجه رغم عدم حدوث ذلك.
  if (loading) {
    return null
  }

  if (role) {
    return <Navigate to={DASHBOARD_PATH_BY_ROLE[role]} replace />
  }

  return (
    <div className="login-screen">
      <div className="login-select-card">
        <Logo size={88} />
        <h1>تسجيل الدخول</h1>
        <p className="login-select-subtitle">نظام إدارة مراكز تحفيظ القرآن الكريم</p>

        <div className="role-button-list">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.path}
              type="button"
              className={`role-button role-button--${option.variant}`}
              onClick={() => navigate(option.path)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

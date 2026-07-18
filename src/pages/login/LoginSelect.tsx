import { useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import './Login.css'

const ROLE_OPTIONS = [
  { path: '/login/manager', label: 'دخول المدير', variant: 'manager' },
  { path: '/login/teacher', label: 'دخول المحفظ', variant: 'teacher' },
  { path: '/login/parent', label: 'دخول ولي الأمر', variant: 'parent' },
]

export default function LoginSelect() {
  const navigate = useNavigate()

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

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'
import Logo from '../../components/Logo'
import ExcelExportButton from './ExcelExportButton'
import '../../styles/dashboard.css'

interface HubCardConfig {
  to: string
  icon: string
  label: string
  badge?: number
}

export default function ManagerDashboard() {
  const { managerUser, isSuperAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [pendingDeletionCount, setPendingDeletionCount] = useState(0)

  useEffect(() => {
    if (!isSuperAdmin) return

    supabase
      .from(TABLES.students)
      .select('id', { count: 'exact', head: true })
      .not('deletion_requested_at', 'is', null)
      .then(({ count }) => setPendingDeletionCount(count ?? 0))
  }, [isSuperAdmin])

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  const cards: HubCardConfig[] = [
    { to: '/manager/centers', icon: '🏢', label: 'المراكز' },
    { to: '/manager/teachers', icon: '📖', label: 'المحفظون' },
    { to: '/manager/students', icon: '🎓', label: 'الطلاب' },
  ]

  if (isSuperAdmin) {
    cards.push(
      {
        to: '/manager/deletion-requests',
        icon: '⏳',
        label: 'طلبات الحذف',
        badge: pendingDeletionCount > 0 ? pendingDeletionCount : undefined,
      },
      { to: '/manager/managers', icon: '🛡️', label: 'المدراء' },
      { to: '/manager/backup', icon: '💾', label: 'النسخ الاحتياطي' },
    )
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
          <button type="button" className="logout-button" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div className="hub-grid">
        {cards.map((card) => (
          <Link key={card.to} className="hub-card" to={card.to}>
            {card.badge !== undefined && <span className="hub-card-badge">{card.badge}</span>}
            <span className="hub-card-icon">{card.icon}</span>
            <span className="hub-card-label">{card.label}</span>
          </Link>
        ))}
      </div>

      <div className="hub-quick-actions">
        <ExcelExportButton />
      </div>
    </div>
  )
}

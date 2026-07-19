import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

interface ManagerSectionPageProps {
  title: string
  requireSuperAdmin?: boolean
  children: ReactNode
}

// غلاف رفيع لكل قسم فرعي بلوحة المدير: عنوان + رابط رجوع للشاشة الرئيسية،
// مع حارس اختياري لصلاحية سوبر أدمن — طبقة حماية إضافية بالواجهة فقط (فوق
// RLS الفعلية الموجودة أصلًا) لمنع مدير عادي من رؤية محتوى قسم غير مصرح له
// به حتى لو كتب الرابط مباشرة.
export default function ManagerSectionPage({
  title,
  requireSuperAdmin = false,
  children,
}: ManagerSectionPageProps) {
  const { isSuperAdmin } = useAuth()

  return (
    <div className="dashboard-page">
      <Link className="back-link-button" to="/manager">
        ← الرجوع للرئيسية
      </Link>

      <div className="student-detail-header">
        <h1>{title}</h1>
      </div>

      {requireSuperAdmin && !isSuperAdmin ? (
        <p className="form-error">غير مصرح لك بالوصول لهذا القسم.</p>
      ) : (
        children
      )}
    </div>
  )
}

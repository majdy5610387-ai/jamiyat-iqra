import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'
import { useAuth } from '../../auth/AuthContext'
import { getStudentFullName, type Center, type ProgressRecord, type Student } from '../../types'
import '../../styles/dashboard.css'

type LatestProgress = ProgressRecord & {
  evaluation: { rating: number } | null
}

function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

export default function CenterStudents() {
  const { centerId } = useParams<{ centerId: string }>()
  const { isSuperAdmin } = useAuth()

  const [center, setCenter] = useState<Center | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [latestByStudent, setLatestByStudent] = useState<Map<string, LatestProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    if (!centerId) return

    let cancelled = false
    setLoading(true)
    setAccessDenied(false)

    async function load() {
      if (!isSuperAdmin) {
        const { data: accessibleIds, error: accessError } = await supabase.rpc(
          'get_my_accessible_center_ids',
        )
        if (cancelled) return
        if (accessError || !(accessibleIds as string[])?.includes(centerId!)) {
          setAccessDenied(true)
          setLoading(false)
          return
        }
      }

      const [centerRes, studentsRes] = await Promise.all([
        supabase.from(TABLES.centers).select('*').eq('id', centerId).maybeSingle(),
        supabase
          .from(TABLES.students)
          .select('*')
          .eq('center_id', centerId)
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      setCenter((centerRes.data as Center) ?? null)
      const studentRows = (studentsRes.data as Student[]) ?? []
      setStudents(studentRows)

      const studentIds = studentRows.map((s) => s.id)
      if (studentIds.length > 0) {
        const { data: progressData } = await supabase
          .from(TABLES.progressRecords)
          .select('*, evaluation:evaluations(rating)')
          .in('student_id', studentIds)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (!cancelled) {
          const latest = new Map<string, LatestProgress>()
          for (const record of (progressData as unknown as LatestProgress[]) ?? []) {
            if (!latest.has(record.student_id)) {
              latest.set(record.student_id, record)
            }
          }
          setLatestByStudent(latest)
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [centerId, isSuperAdmin])

  if (!centerId) {
    return null
  }

  return (
    <div className="dashboard-page">
      <Link className="back-link-button" to="/manager">
        ← الرجوع للمراكز
      </Link>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : accessDenied ? (
        <p className="form-error">غير مصرح لك بالوصول لهذا المركز.</p>
      ) : !center ? (
        <p className="empty-state">تعذّر إيجاد هذا المركز.</p>
      ) : (
        <>
          <div className="student-detail-header">
            <h1>طلاب مركز {center.name}</h1>
          </div>

          <section className="section-card">
            {students.length === 0 ? (
              <p className="empty-state">لا يوجد طلاب بهذا المركز بعد.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الاسم الرباعي</th>
                    <th>رقم الهوية</th>
                    <th>آخر سجل حفظ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const latest = latestByStudent.get(student.id)
                    return (
                      <tr key={student.id}>
                        <td>
                          {getStudentFullName(student)}
                          {student.deletion_requested_at && (
                            <span title="بانتظار موافقة السوبر أدمن على الحذف"> ⏳</span>
                          )}
                        </td>
                        <td>{student.national_id}</td>
                        <td>
                          {latest ? (
                            <>
                              {latest.date} — {latest.surah} ({latest.from_ayah}-{latest.to_ayah})
                              {latest.evaluation && (
                                <span className="star-display">
                                  {' '}
                                  {renderStars(latest.evaluation.rating)}
                                </span>
                              )}
                            </>
                          ) : (
                            'لا يوجد سجل بعد'
                          )}
                        </td>
                        <td>
                          <Link className="detail-link" to={`/manager/students/${student.id}`}>
                            عرض التفاصيل
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}

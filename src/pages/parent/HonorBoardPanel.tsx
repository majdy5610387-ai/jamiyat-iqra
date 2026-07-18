import { useEffect, useState } from 'react'
import { useSupabaseClient } from '../../supabase/useSupabaseClient'

interface HonorBoardRow {
  category: 'overall' | 'weekly'
  student_id: string
  first_name: string
  father_name: string
  grandfather_name: string
  family_name: string
}

function fullName(row: HonorBoardRow): string {
  return `${row.first_name} ${row.father_name} ${row.grandfather_name} ${row.family_name}`
}

// قراءة فقط — عبر get_child_center_honor_board() التي تُرجع اسم الطالب فقط
// (بدون رقم هوية أو أي تفاصيل حساسة)، ومحدَّدة بمركز طفل ولي الأمر تلقائيًا
// من الخادم.
export default function HonorBoardPanel() {
  const supabase = useSupabaseClient()
  const [rows, setRows] = useState<HonorBoardRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    supabase.rpc('get_child_center_honor_board').then(({ data, error }) => {
      if (!cancelled) {
        if (!error) setRows((data as HonorBoardRow[]) ?? [])
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [supabase])

  if (loading) {
    return null
  }

  const overall = rows.filter((r) => r.category === 'overall')
  const weekly = rows.filter((r) => r.category === 'weekly')

  if (overall.length === 0 && weekly.length === 0) {
    return null
  }

  return (
    <section className="section-card">
      <h2>لوحة الشرف</h2>

      <div>
        <h3>الأكثر حفظًا (إجمالي)</h3>
        {overall.length === 0 ? (
          <p className="empty-state">لا يوجد بعد.</p>
        ) : (
          <ul>
            {overall.map((row) => (
              <li key={row.student_id}>{fullName(row)}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3>الأكثر حفظًا أسبوعيًا</h3>
        {weekly.length === 0 ? (
          <p className="empty-state">لا يوجد بعد.</p>
        ) : (
          <ul>
            {weekly.map((row) => (
              <li key={row.student_id}>{fullName(row)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

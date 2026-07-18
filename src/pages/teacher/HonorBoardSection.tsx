import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useSupabaseClient } from '../../supabase/useSupabaseClient'
import { TABLES } from '../../supabase/tables'
import { getStudentFullName, type Student } from '../../types'

const MAX_ENTRIES = 5

type Category = 'overall' | 'weekly'

interface CategoryState {
  selected: Set<string>
  error: string | null
  success: string | null
  saving: boolean
}

function emptyCategoryState(): CategoryState {
  return { selected: new Set(), error: null, success: null, saving: false }
}

// ميزة أونلاين فقط (مثل طلب حذف الطالب) — ليست جزءًا من نظام Dexie/المزامنة،
// فلا حاجة لأي دعم عمل بدون إنترنت هنا.
export default function HonorBoardSection() {
  const { customSession } = useAuth()
  const supabase = useSupabaseClient()

  const [centerId, setCenterId] = useState<string | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [overall, setOverall] = useState<CategoryState>(emptyCategoryState())
  const [weekly, setWeekly] = useState<CategoryState>(emptyCategoryState())

  async function loadData() {
    if (!customSession) return

    setLoading(true)
    setLoadError(null)

    const { data: teacherRow, error: teacherError } = await supabase
      .from(TABLES.teachers)
      .select('center_id')
      .eq('id', customSession.sub)
      .single()

    if (teacherError || !teacherRow) {
      setLoadError('تعذّر جلب بيانات مركزك')
      setLoading(false)
      return
    }

    const myCenterId = teacherRow.center_id as string
    setCenterId(myCenterId)

    const [studentsRes, entriesRes] = await Promise.all([
      supabase
        .from(TABLES.students)
        .select('*')
        .eq('center_id', myCenterId)
        .order('first_name'),
      supabase
        .from(TABLES.honorBoardEntries)
        .select('student_id, category')
        .eq('center_id', myCenterId),
    ])

    if (!studentsRes.error) setStudents((studentsRes.data as Student[]) ?? [])

    const entries = (entriesRes.data as { student_id: string; category: Category }[]) ?? []
    setOverall({
      ...emptyCategoryState(),
      selected: new Set(entries.filter((e) => e.category === 'overall').map((e) => e.student_id)),
    })
    setWeekly({
      ...emptyCategoryState(),
      selected: new Set(entries.filter((e) => e.category === 'weekly').map((e) => e.student_id)),
    })

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customSession])

  function toggle(category: Category, studentId: string) {
    const state = category === 'overall' ? overall : weekly
    const setState = category === 'overall' ? setOverall : setWeekly

    const next = new Set(state.selected)
    if (next.has(studentId)) {
      next.delete(studentId)
    } else {
      if (next.size >= MAX_ENTRIES) {
        setState({ ...state, error: `لا يمكن اختيار أكثر من ${MAX_ENTRIES} طلاب لهذا القسم` })
        return
      }
      next.add(studentId)
    }
    setState({ ...state, selected: next, error: null, success: null })
  }

  async function save(category: Category) {
    if (!centerId) return
    const state = category === 'overall' ? overall : weekly
    const setState = category === 'overall' ? setOverall : setWeekly

    setState({ ...state, saving: true, error: null, success: null })
    try {
      const { error } = await supabase.rpc('set_honor_board', {
        p_center_id: centerId,
        p_category: category,
        p_student_ids: Array.from(state.selected),
      })

      if (error) {
        setState({ ...state, saving: false, error: 'تعذّر الحفظ: ' + error.message })
        return
      }

      setState({ ...state, saving: false, success: 'تم الحفظ بنجاح' })
    } catch {
      setState({ ...state, saving: false, error: 'حدث خطأ غير متوقع' })
    }
  }

  function renderCategory(title: string, category: Category, state: CategoryState) {
    return (
      <div>
        <h3>
          {title} ({state.selected.size}/{MAX_ENTRIES})
        </h3>
        {students.length === 0 ? (
          <p className="empty-state">لا يوجد طلاب بمركزك بعد.</p>
        ) : (
          <div>
            {students.map((student) => (
              <label key={student.id} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={state.selected.has(student.id)}
                  onChange={() => toggle(category, student.id)}
                />
                {' '}{getStudentFullName(student)}
              </label>
            ))}
          </div>
        )}
        {state.error && <p className="form-error">{state.error}</p>}
        {state.success && <p className="form-success">{state.success}</p>}
        <button
          type="button"
          className="add-button"
          disabled={state.saving}
          onClick={() => save(category)}
        >
          {state.saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    )
  }

  return (
    <section className="section-card">
      <h2>لوحة الشرف</h2>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : loadError ? (
        <p className="form-error">{loadError}</p>
      ) : (
        <>
          {renderCategory('الأكثر حفظًا (إجمالي)', 'overall', overall)}
          <hr />
          {renderCategory('الأكثر حفظًا أسبوعيًا', 'weekly', weekly)}
        </>
      )}
    </section>
  )
}

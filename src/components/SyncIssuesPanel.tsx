import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../auth/AuthContext'
import { useTeacherDb } from '../offline/useTeacherDb'
import { retryOutboxItem, discardFailedEntity } from '../offline/repository'
import { getLocalStudentFullName } from '../offline/helpers'
import type { OutboxItem } from '../offline/db'

// يظهر فقط لو وُجدت عناصر outbox بحالة "failed" (تعارض دائم توقف عن إعادة
// المحاولة التلقائية) — يمنح المحفظ رؤية واضحة وخيار تصرّف بدل انتظار صامت
// لن ينجح أبدًا.
export default function SyncIssuesPanel() {
  const { customSession } = useAuth()
  const db = useTeacherDb()

  const failedItems = useLiveQuery(
    () => (db ? db.outbox.where('status').equals('failed').toArray() : []),
    [db],
  )
  const students = useLiveQuery(() => (db ? db.students.toArray() : []), [db])
  const progressRecords = useLiveQuery(() => (db ? db.progressRecords.toArray() : []), [db])

  if (!db || !customSession || !failedItems || failedItems.length === 0) {
    return null
  }

  function labelFor(item: OutboxItem): string {
    if (item.entityTable === 'students') {
      const student = students?.find((s) => s.id === item.entityId)
      return student ? `طالب: ${getLocalStudentFullName(student)}` : 'طالب (لم يعد موجودًا محليًا)'
    }
    const record = progressRecords?.find((r) => r.id === item.entityId)
    return record ? `سجل حفظ: ${record.surah} (${record.date})` : 'سجل حفظ (لم يعد موجودًا محليًا)'
  }

  async function handleRetry(localId: number) {
    if (!customSession) return
    await retryOutboxItem(customSession.sub, localId)
  }

  async function handleDiscard(entityTable: 'students' | 'progressRecords', entityId: string) {
    if (!customSession) return
    if (!window.confirm('هل تريد حذف هذا العنصر نهائيًا من هذا الجهاز؟ لن تتم مزامنته أبدًا.')) {
      return
    }
    await discardFailedEntity(customSession.sub, entityTable, entityId)
  }

  return (
    <section className="section-card">
      <h2>⚠️ مشاكل مزامنة ({failedItems.length})</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>العنصر</th>
            <th>سبب الفشل</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {failedItems.map((item) => (
            <tr key={item.localId}>
              <td>{labelFor(item)}</td>
              <td>{item.lastError || '—'}</td>
              <td>
                <button
                  type="button"
                  className="detail-link"
                  onClick={() => handleRetry(item.localId!)}
                >
                  إعادة المحاولة
                </button>
                {' | '}
                <button
                  type="button"
                  className="detail-link"
                  onClick={() => handleDiscard(item.entityTable, item.entityId)}
                >
                  حذف نهائيًا
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

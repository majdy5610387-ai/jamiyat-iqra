import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'
import { useAuth } from '../../auth/AuthContext'
import type { Center } from '../../types'

export default function CentersSection() {
  const { isSuperAdmin } = useAuth()
  const [centers, setCenters] = useState<Center[]>([])
  const [accessibleCenterIds, setAccessibleCenterIds] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  async function loadCenters() {
    setLoading(true)
    const { data, error } = await supabase
      .from(TABLES.centers)
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setCenters((data as Center[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadCenters()
  }, [])

  useEffect(() => {
    if (isSuperAdmin) return

    supabase.rpc('get_my_accessible_center_ids').then(({ data, error }) => {
      if (!error) setAccessibleCenterIds(new Set((data as string[]) ?? []))
    })
  }, [isSuperAdmin])

  function canViewCenter(centerId: string): boolean {
    return isSuperAdmin || (accessibleCenterIds?.has(centerId) ?? false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('اسم المركز مطلوب')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from(TABLES.centers).insert({
      name: name.trim(),
      address: address.trim() || null,
    })
    setSubmitting(false)

    if (error) {
      setFormError('تعذّرت إضافة المركز: ' + error.message)
      return
    }

    setName('')
    setAddress('')
    await loadCenters()
  }

  function startEdit(center: Center) {
    setRowError(null)
    setEditingId(center.id)
    setEditName(center.name)
    setEditAddress(center.address || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setRowError(null)
  }

  async function saveEdit(centerId: string) {
    if (!editName.trim()) {
      setRowError('اسم المركز مطلوب')
      return
    }

    setRowBusy(centerId)
    try {
      const { error } = await supabase
        .from(TABLES.centers)
        .update({ name: editName.trim(), address: editAddress.trim() || null })
        .eq('id', centerId)

      if (error) {
        setRowError('تعذّر حفظ التعديل: ' + error.message)
        return
      }

      setEditingId(null)
      await loadCenters()
    } finally {
      setRowBusy(null)
    }
  }

  async function handleDelete(centerId: string) {
    if (!window.confirm('هل أنت متأكد من حذف هذا المركز؟')) return

    setRowError(null)
    setRowBusy(centerId)
    try {
      const { error } = await supabase.from(TABLES.centers).delete().eq('id', centerId)

      if (error) {
        if (error.code === '23503') {
          setRowError('لا يمكن حذف هذا المركز لأنه يحتوي على محفظين مسجّلين — احذف أو انقل المحفظين أولًا')
        } else {
          setRowError('تعذّر حذف المركز: ' + error.message)
        }
        return
      }

      await loadCenters()
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <section className="section-card">
      <h2>المراكز</h2>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : centers.length === 0 ? (
        <p className="empty-state">لا توجد مراكز بعد.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>العنوان</th>
              <th></th>
              {isSuperAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {centers.map((center) =>
              editingId === center.id ? (
                <tr key={center.id}>
                  <td>
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(event) => setEditAddress(event.target.value)}
                    />
                  </td>
                  <td></td>
                  <td>
                    <button
                      type="button"
                      className="detail-link"
                      disabled={rowBusy === center.id}
                      onClick={() => saveEdit(center.id)}
                    >
                      حفظ
                    </button>
                    {' | '}
                    <button type="button" className="detail-link" onClick={cancelEdit}>
                      إلغاء
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={center.id}>
                  <td>{center.name}</td>
                  <td>{center.address || '—'}</td>
                  <td>
                    {canViewCenter(center.id) ? (
                      <Link className="detail-link" to={`/manager/centers/${center.id}`}>
                        عرض الطلاب
                      </Link>
                    ) : (
                      <span
                        className="detail-link"
                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                        title="غير مصرح لك بهذا المركز"
                      >
                        عرض الطلاب
                      </span>
                    )}
                  </td>
                  {isSuperAdmin && (
                    <td>
                      <button
                        type="button"
                        className="detail-link"
                        onClick={() => startEdit(center)}
                      >
                        تعديل
                      </button>
                      {' | '}
                      <button
                        type="button"
                        className="detail-link"
                        disabled={rowBusy === center.id}
                        onClick={() => handleDelete(center.id)}
                      >
                        حذف
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {rowError && <p className="form-error">{rowError}</p>}

      {isSuperAdmin && (
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="center-name">اسم المركز</label>
            <input
              id="center-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="center-address">العنوان (اختياري)</label>
            <input
              id="center-address"
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <button type="submit" className="add-button" disabled={submitting}>
            {submitting ? 'جاري الإضافة...' : 'إضافة مركز'}
          </button>
          {formError && <p className="form-error">{formError}</p>}
        </form>
      )}
    </section>
  )
}

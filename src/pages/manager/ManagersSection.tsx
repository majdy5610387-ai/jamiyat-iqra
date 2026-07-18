import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../supabase/client'
import { createIsolatedSupabaseClient } from '../../supabase/isolatedClient'
import { TABLES } from '../../supabase/tables'
import { useAuth } from '../../auth/AuthContext'
import type { Center, Manager } from '../../types'

export default function ManagersSection() {
  const { managerUser } = useAuth()
  const [managers, setManagers] = useState<Manager[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [loading, setLoading] = useState(true)

  const [accessEditingId, setAccessEditingId] = useState<string | null>(null)
  const [accessSelectedCenterIds, setAccessSelectedCenterIds] = useState<Set<string>>(new Set())
  const [accessError, setAccessError] = useState<string | null>(null)
  const [accessBusy, setAccessBusy] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editIsSuperAdmin, setEditIsSuperAdmin] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const [resetLinkBusy, setResetLinkBusy] = useState<string | null>(null)
  const [resetLinkMessage, setResetLinkMessage] = useState<string | null>(null)

  async function loadManagers() {
    setLoading(true)
    const [managersRes, centersRes] = await Promise.all([
      supabase.from(TABLES.managers).select('*').order('created_at', { ascending: false }),
      supabase.from(TABLES.centers).select('*').order('name'),
    ])

    if (!managersRes.error) setManagers((managersRes.data as Manager[]) ?? [])
    if (!centersRes.error) setCenters((centersRes.data as Center[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadManagers()
  }, [])

  async function startEditAccess(manager: Manager) {
    setAccessError(null)
    setEditingId(null)
    setAccessEditingId(manager.id)
    setAccessSelectedCenterIds(new Set())

    const { data, error } = await supabase
      .from(TABLES.managerCenterAccess)
      .select('center_id')
      .eq('manager_id', manager.id)

    if (!error) {
      setAccessSelectedCenterIds(new Set((data ?? []).map((row) => row.center_id as string)))
    }
  }

  function cancelEditAccess() {
    setAccessEditingId(null)
    setAccessError(null)
  }

  function toggleAccessCenter(centerId: string) {
    setAccessSelectedCenterIds((prev) => {
      const next = new Set(prev)
      if (next.has(centerId)) {
        next.delete(centerId)
      } else {
        next.add(centerId)
      }
      return next
    })
  }

  async function saveAccess(managerId: string) {
    setAccessError(null)
    setAccessBusy(true)
    try {
      const { error } = await supabase.rpc('set_manager_center_access', {
        p_manager_id: managerId,
        p_center_ids: Array.from(accessSelectedCenterIds),
      })

      if (error) {
        setAccessError('تعذّر حفظ تحديد المراكز: ' + error.message)
        return
      }

      setAccessEditingId(null)
    } finally {
      setAccessBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail || !password) {
      setFormError('يرجى تعبئة جميع الحقول')
      return
    }
    if (password.length < 6) {
      setFormError('كلمة المرور يجب ألا تقل عن 6 أحرف/أرقام')
      return
    }

    setSubmitting(true)
    try {
      // تحقق مسبق من عدم تكرار البريد قبل محاولة إنشاء الحساب
      const { data: existing, error: existingError } = await supabase
        .from(TABLES.managers)
        .select('id')
        .ilike('email', trimmedEmail)
        .maybeSingle()

      if (existingError) {
        setFormError('تعذّر التحقق من البريد: ' + existingError.message)
        return
      }
      if (existing) {
        setFormError('هذا البريد مستخدم مسبقًا لمدير آخر')
        return
      }

      // عميل معزول بدون حفظ جلسة، حتى لا تُستبدل جلسة المدير الحالي
      // بجلسة الحساب الجديد بعد signUp
      const isolated = createIsolatedSupabaseClient()
      const { data: signUpData, error: signUpError } = await isolated.auth.signUp({
        email: trimmedEmail,
        password,
      })

      if (signUpError) {
        setFormError('تعذّر إنشاء حساب المدير: ' + signUpError.message)
        return
      }

      if (!signUpData.user || signUpData.user.identities?.length === 0) {
        setFormError('هذا البريد مستخدم مسبقًا في النظام')
        return
      }

      const { error: insertError } = await supabase.from(TABLES.managers).insert({
        id: signUpData.user.id,
        full_name: trimmedName,
        email: trimmedEmail,
      })

      if (insertError) {
        setFormError(
          'تم إنشاء حساب الدخول لكن فشل حفظ بيانات المدير: ' + insertError.message,
        )
        return
      }

      setFormSuccess('تم إنشاء حساب المدير بنجاح')
      setFullName('')
      setEmail('')
      setPassword('')
      await loadManagers()
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(manager: Manager) {
    setRowError(null)
    setAccessEditingId(null)
    setEditingId(manager.id)
    setEditFullName(manager.full_name)
    setEditIsSuperAdmin(manager.is_super_admin)
  }

  function cancelEdit() {
    setEditingId(null)
    setRowError(null)
  }

  async function saveEdit(managerId: string) {
    if (!editFullName.trim()) {
      setRowError('الاسم الكامل مطلوب')
      return
    }

    setRowBusy(managerId)
    try {
      const { error } = await supabase
        .from(TABLES.managers)
        .update({ full_name: editFullName.trim(), is_super_admin: editIsSuperAdmin })
        .eq('id', managerId)

      if (error) {
        setRowError('تعذّر حفظ التعديل: ' + error.message)
        return
      }

      setEditingId(null)
      await loadManagers()
    } finally {
      setRowBusy(null)
    }
  }

  async function handleSendResetLink(manager: Manager) {
    setResetLinkMessage(null)
    setResetLinkBusy(manager.id)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(manager.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setResetLinkMessage('تعذّر إرسال رابط إعادة التعيين: ' + error.message)
        return
      }

      setResetLinkMessage(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${manager.email}`)
    } finally {
      setResetLinkBusy(null)
    }
  }

  async function handleDelete(managerId: string) {
    if (!window.confirm('هل أنت متأكد من حذف هذا المدير؟')) return

    setRowError(null)
    setRowBusy(managerId)
    try {
      const { error } = await supabase.from(TABLES.managers).delete().eq('id', managerId)

      if (error) {
        setRowError('تعذّر حذف المدير: ' + error.message)
        return
      }

      await loadManagers()
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <section className="section-card">
      <h2>المدراء</h2>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : managers.length === 0 ? (
        <p className="empty-state">لا يوجد مدراء بعد.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد الإلكتروني</th>
              <th>الصلاحية</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {managers.map((manager) => {
              const isSelf = manager.id === managerUser?.id

              if (editingId === manager.id) {
                return (
                  <tr key={manager.id}>
                    <td>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(event) => setEditFullName(event.target.value)}
                      />
                    </td>
                    <td>{manager.email}</td>
                    <td>
                      <label>
                        <input
                          type="checkbox"
                          checked={editIsSuperAdmin}
                          disabled={isSelf}
                          onChange={(event) => setEditIsSuperAdmin(event.target.checked)}
                        />
                        {' '}مدير عام
                      </label>
                      {isSelf && (
                        <p className="loading-text">لا يمكنك تغيير صلاحيتك الخاصة</p>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="detail-link"
                        disabled={rowBusy === manager.id}
                        onClick={() => saveEdit(manager.id)}
                      >
                        حفظ
                      </button>
                      {' | '}
                      <button type="button" className="detail-link" onClick={cancelEdit}>
                        إلغاء
                      </button>
                    </td>
                  </tr>
                )
              }

              return (
                <Fragment key={manager.id}>
                  <tr key={manager.id}>
                    <td>{manager.full_name}</td>
                    <td>{manager.email}</td>
                    <td>{manager.is_super_admin ? 'مدير عام' : 'مدير عادي'}</td>
                    <td>
                      <button type="button" className="detail-link" onClick={() => startEdit(manager)}>
                        تعديل
                      </button>
                      {' | '}
                      <button
                        type="button"
                        className="detail-link"
                        disabled={resetLinkBusy === manager.id}
                        onClick={() => handleSendResetLink(manager)}
                      >
                        إرسال رابط إعادة تعيين كلمة المرور
                      </button>
                      {!manager.is_super_admin && (
                        <>
                          {' | '}
                          <button
                            type="button"
                            className="detail-link"
                            onClick={() => startEditAccess(manager)}
                          >
                            تحديد المراكز المصرح بها
                          </button>
                        </>
                      )}
                      {!isSelf && (
                        <>
                          {' | '}
                          <button
                            type="button"
                            className="detail-link"
                            disabled={rowBusy === manager.id}
                            onClick={() => handleDelete(manager.id)}
                          >
                            حذف
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {accessEditingId === manager.id && (
                    <tr>
                      <td colSpan={4}>
                        <p>المراكز المصرح بها لـ{manager.full_name}:</p>
                        {centers.length === 0 ? (
                          <p className="empty-state">لا توجد مراكز بعد.</p>
                        ) : (
                          <div>
                            {centers.map((center) => (
                              <label key={center.id} style={{ display: 'block' }}>
                                <input
                                  type="checkbox"
                                  checked={accessSelectedCenterIds.has(center.id)}
                                  onChange={() => toggleAccessCenter(center.id)}
                                />
                                {' '}{center.name}
                              </label>
                            ))}
                          </div>
                        )}
                        {accessError && <p className="form-error">{accessError}</p>}
                        <button
                          type="button"
                          className="detail-link"
                          disabled={accessBusy}
                          onClick={() => saveAccess(manager.id)}
                        >
                          حفظ
                        </button>
                        {' | '}
                        <button type="button" className="detail-link" onClick={cancelEditAccess}>
                          إلغاء
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}

      {rowError && <p className="form-error">{rowError}</p>}
      {resetLinkMessage && <p className="form-success">{resetLinkMessage}</p>}

      <form className="inline-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="manager-name">الاسم الكامل</label>
          <input
            id="manager-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="manager-email">البريد الإلكتروني</label>
          <input
            id="manager-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="manager-password">كلمة المرور</label>
          <input
            id="manager-password"
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="submit" className="add-button" disabled={submitting}>
          {submitting ? 'جاري الإضافة...' : 'إضافة مدير'}
        </button>
        {formError && <p className="form-error">{formError}</p>}
        {formSuccess && <p className="form-success">{formSuccess}</p>}
      </form>
    </section>
  )
}

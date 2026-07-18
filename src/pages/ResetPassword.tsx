import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase/client'
import './login/Login.css'

// وجهة رابط "نسيت كلمة المرور" الذي يرسله Supabase عبر البريد. عميل
// Supabase (detectSessionInUrl الافتراضي) يقرأ تلقائيًا جلسة الاسترجاع
// المؤقتة من الرابط عند تحميل الصفحة، فلا حاجة لأي معالجة يدوية لذلك هنا —
// فقط استدعاء auth.updateUser() لإتمام التعيين.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 أحرف/أرقام')
      return
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(
          'تعذّر تحديث كلمة المرور: ' +
            error.message +
            ' — تأكد أنك فتحت هذه الصفحة من رابط البريد الإلكتروني مباشرة وأنه لم تنتهِ صلاحيته',
        )
        return
      }

      setSuccess(true)
      setTimeout(() => navigate('/'), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="login-screen">
        <div className="login-form-card">
          <h2>تم تحديث كلمة المرور بنجاح</h2>
          <p>سيتم تحويلك لصفحة تسجيل الدخول خلال لحظات...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <form className="login-form-card" onSubmit={handleSubmit}>
        <h2>تعيين كلمة مرور جديدة</h2>

        {error && <p className="form-error">{error}</p>}

        <div className="form-field">
          <label htmlFor="new-password">كلمة المرور الجديدة</label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        <button type="submit" className="submit-button" disabled={submitting}>
          {submitting ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
        </button>
      </form>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isValidNationalId, sanitizeNationalIdInput, NATIONAL_ID_ERROR_MESSAGE } from '../utils/nationalId'
import '../pages/login/Login.css'

interface RoleLoginFormProps {
  title: string
  identifierLabel: string
  identifierType?: 'email' | 'text'
  onSubmit: (identifier: string, password: string) => Promise<void>
}

export default function RoleLoginForm({
  title,
  identifierLabel,
  identifierType = 'text',
  onSubmit,
}: RoleLoginFormProps) {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!identifier.trim() || !password) {
      setError('يرجى تعبئة جميع الحقول')
      return
    }

    if (identifierType !== 'email' && !isValidNationalId(identifier.trim())) {
      setError(NATIONAL_ID_ERROR_MESSAGE)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(identifier.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بيانات الدخول غير صحيحة')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-form-card" onSubmit={handleSubmit}>
        <h2>{title}</h2>

        {error && <p className="form-error">{error}</p>}

        <div className="form-field">
          <label htmlFor="identifier">{identifierLabel}</label>
          <input
            id="identifier"
            type={identifierType}
            inputMode={identifierType === 'email' ? undefined : 'numeric'}
            maxLength={identifierType === 'email' ? undefined : 9}
            value={identifier}
            onChange={(event) =>
              setIdentifier(
                identifierType === 'email'
                  ? event.target.value
                  : sanitizeNationalIdInput(event.target.value),
              )
            }
            autoComplete="username"
          />
        </div>

        <div className="form-field">
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="submit-button" disabled={submitting}>
          {submitting ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>

        <button
          type="button"
          className="back-link"
          onClick={() => navigate('/')}
        >
          الرجوع لاختيار نوع الحساب
        </button>
      </form>
    </div>
  )
}

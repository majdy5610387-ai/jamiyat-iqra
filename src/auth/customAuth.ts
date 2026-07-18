export interface CustomSession {
  access_token: string
  app_role: 'teacher' | 'parent'
  sub: string
  expires_at: number
}

const STORAGE_KEY = 'custom_auth_session'

function decodeJwtPayload(token: string): { sub: string; app_role: string; exp: number } {
  const payloadB64 = token.split('.')[1]
  const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(json)
}

export async function loginWithCustomAuth(
  nationalId: string,
  password: string,
  role: 'teacher' | 'parent',
): Promise<CustomSession> {
  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/custom-login`

  const response = await fetch(functionsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ national_id: nationalId, password, role }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'تعذّر تسجيل الدخول')
  }

  const payload = decodeJwtPayload(result.access_token)

  const session: CustomSession = {
    access_token: result.access_token,
    app_role: result.app_role,
    sub: payload.sub,
    expires_at: result.expires_at,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

export function getStoredCustomSession(): CustomSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as CustomSession
    if (!session.expires_at || session.expires_at * 1000 < Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return session
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearCustomSession() {
  localStorage.removeItem(STORAGE_KEY)
}

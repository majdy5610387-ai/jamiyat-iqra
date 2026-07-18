import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session as SupabaseSession, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { getStoredCustomSession, clearCustomSession, type CustomSession } from './customAuth'
import { startSyncEngine } from '../offline/syncEngine'
import type { UserRole } from '../types'

interface AuthContextValue {
  loading: boolean
  role: UserRole | null
  managerUser: SupabaseUser | null
  isSuperAdmin: boolean
  customSession: CustomSession | null
  refreshCustomSession: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  role: null,
  managerUser: null,
  isSuperAdmin: false,
  customSession: null,
  refreshCustomSession: () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSession | null>(null)
  const [customSession, setCustomSession] = useState<CustomSession | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  function refreshCustomSession() {
    setCustomSession(getStoredCustomSession())
  }

  useEffect(() => {
    // مرة واحدة فقط طوال عمر التطبيق — تُفعّل حدث online والمؤقّت الدوري
    // لمزامنة outbox المحفظ (الدالة نفسها آمنة الاستدعاء حتى لو لم يكن
    // المستخدم الحالي محفظًا إطلاقًا، لا تفعل شيئًا في تلك الحالة).
    startSyncEngine()

    supabase.auth.getSession().then(({ data }) => {
      setSupabaseSession(data.session)
      refreshCustomSession()
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSupabaseSession(nextSession)
      },
    )

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabaseSession) {
      setIsSuperAdmin(false)
      return
    }

    supabase
      .from('managers')
      .select('is_super_admin')
      .eq('id', supabaseSession.user.id)
      .single()
      .then(({ data }) => {
        setIsSuperAdmin(Boolean((data as { is_super_admin: boolean } | null)?.is_super_admin))
      })
  }, [supabaseSession])

  const role: UserRole | null = supabaseSession
    ? 'manager'
    : customSession
      ? customSession.app_role
      : null

  async function signOut() {
    await supabase.auth.signOut()
    clearCustomSession()
    setCustomSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        role,
        managerUser: supabaseSession?.user ?? null,
        isSuperAdmin,
        customSession,
        refreshCustomSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

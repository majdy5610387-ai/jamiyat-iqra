import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from './client'
import { createCustomAuthClient } from './authenticatedClient'

// يُعيد العميل الصحيح تلقائيًا حسب الدور الحالي: عميل Supabase Auth الافتراضي
// للمدير، أو عميل مرتبط بتوكن الجلسة المخصصة للمحفظ/ولي الأمر.
export function useSupabaseClient() {
  const { role, customSession } = useAuth()

  return useMemo(() => {
    if ((role === 'teacher' || role === 'parent') && customSession) {
      return createCustomAuthClient(customSession.access_token)
    }
    return supabase
  }, [role, customSession])
}

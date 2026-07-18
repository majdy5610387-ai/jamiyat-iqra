import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getDb, type HifzTeacherDB } from './db'

// يُعيد قاعدة Dexie الخاصة بالمحفظ الحالي، أو null لو الجلسة ليست جلسة محفظ.
export function useTeacherDb(): HifzTeacherDB | null {
  const { customSession } = useAuth()

  return useMemo(() => {
    if (!customSession || customSession.app_role !== 'teacher') return null
    return getDb(customSession.sub)
  }, [customSession])
}

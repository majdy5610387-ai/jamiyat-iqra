import {
  getDb,
  setTeacherProfile,
  setLastPulledAt,
  type LocalStudent,
  type LocalProgressRecord,
} from './db'
import { getStoredCustomSession } from '../auth/customAuth'
import { createCustomAuthClient } from '../supabase/authenticatedClient'
import { TABLES } from '../supabase/tables'
import type { Student } from '../types'

interface PullResult {
  success: boolean
  error?: string
}

interface ServerProgressRow {
  id: string
  student_id: string
  teacher_id: string
  date: string
  surah: string
  from_ayah: number
  to_ayah: number
  notes: string | null
  record_type: string
  created_at: string
  evaluation: { rating: number } | null
}

// يسحب ملف المحفظ الشخصي (لمعرفة مركزه) + طلاب مركزه + سجلات حفظهم من
// الخادم، ويدمجها بقاعدة Dexie المحلية. يُستدعى عند تسجيل الدخول، وبعد كل
// دورة مزامنة ناجحة (لالتقاط تعديلات محفظين آخرين بنفس المركز).
//
// قاعدة الدمج: أي صف محلي حالته 'pending' أو 'conflict' لا يُلمَس إطلاقًا
// (تعديل محلي لم يُزامَن بعد لا يجب أن يُطمَس بنسخة الخادم القديمة). فقط
// الصفوف المتزامنة (synced) تُحدَّث أو تُحذف (لو اختفت من استجابة الخادم،
// أي حُذفت من جهاز/محفظ آخر لنفس المركز).
export async function pullLatestData(teacherId: string): Promise<PullResult> {
  const session = getStoredCustomSession()
  if (!session || session.app_role !== 'teacher' || session.sub !== teacherId) {
    return { success: false, error: 'جلسة غير صالحة' }
  }
  if (!navigator.onLine) {
    return { success: false, error: 'لا يوجد اتصال بالإنترنت' }
  }

  const db = getDb(teacherId)
  const client = createCustomAuthClient(session.access_token)

  try {
    const { data: teacherRow, error: teacherError } = await client
      .from(TABLES.teachers)
      .select('id, full_name, center_id')
      .eq('id', teacherId)
      .single()

    if (teacherError || !teacherRow) {
      return { success: false, error: teacherError?.message ?? 'تعذّر جلب بيانات المحفظ' }
    }

    await setTeacherProfile(db, {
      teacherId: teacherRow.id,
      centerId: teacherRow.center_id,
      fullName: teacherRow.full_name,
    })

    const { data: serverStudents, error: studentsError } = await client
      .from(TABLES.students)
      .select('*')
      .eq('center_id', teacherRow.center_id)

    if (studentsError) {
      return { success: false, error: studentsError.message }
    }

    const studentRows = (serverStudents as Student[]) ?? []
    const studentIds = studentRows.map((s) => s.id)

    let progressRows: ServerProgressRow[] = []
    if (studentIds.length > 0) {
      const { data: serverProgress, error: progressError } = await client
        .from(TABLES.progressRecords)
        .select('*, evaluation:evaluations(rating)')
        .in('student_id', studentIds)

      if (progressError) {
        return { success: false, error: progressError.message }
      }
      progressRows = (serverProgress as unknown as ServerProgressRow[]) ?? []
    }

    await db.transaction('rw', db.students, db.progressRecords, async () => {
      // ---- الطلاب ----
      const serverStudentIds = new Set(studentIds)
      const localStudents = await db.students.toArray()

      for (const local of localStudents) {
        if (local.syncStatus === 'synced' && !serverStudentIds.has(local.id)) {
          await db.students.delete(local.id)
        }
      }

      for (const server of studentRows) {
        const local = await db.students.get(server.id)
        if (!local || local.syncStatus === 'synced') {
          const record: LocalStudent = {
            id: server.id,
            national_id: server.national_id,
            first_name: server.first_name,
            father_name: server.father_name,
            grandfather_name: server.grandfather_name,
            family_name: server.family_name,
            birth_date: server.birth_date,
            phone: server.phone,
            center_id: server.center_id,
            teacher_id: server.teacher_id,
            created_at: server.created_at,
            deletion_requested_at: server.deletion_requested_at,
            deletion_requested_by: server.deletion_requested_by,
            syncStatus: 'synced',
            syncError: null,
          }
          await db.students.put(record)
        }
        // محلي وحالته pending/conflict: لا نلمسه — تعديل لم يُزامَن بعد
      }

      // ---- سجلات الحفظ والتقييمات ----
      const serverProgressIds = new Set(progressRows.map((p) => p.id))
      const localProgress = await db.progressRecords.toArray()

      for (const local of localProgress) {
        if (local.syncStatus === 'synced' && !serverProgressIds.has(local.id)) {
          await db.progressRecords.delete(local.id)
        }
      }

      for (const server of progressRows) {
        const local = await db.progressRecords.get(server.id)
        if (!local || local.syncStatus === 'synced') {
          const record: LocalProgressRecord = {
            id: server.id,
            student_id: server.student_id,
            teacher_id: server.teacher_id,
            date: server.date,
            surah: server.surah,
            from_ayah: server.from_ayah,
            to_ayah: server.to_ayah,
            notes: server.notes,
            record_type: server.record_type,
            rating: server.evaluation?.rating ?? null,
            created_at: server.created_at,
            syncStatus: 'synced',
            syncError: null,
          }
          await db.progressRecords.put(record)
        }
      }
    })

    await setLastPulledAt(db, Date.now())
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'خطأ غير متوقع' }
  }
}

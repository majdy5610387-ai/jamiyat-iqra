import Dexie, { type Table } from 'dexie'

export type SyncStatus = 'synced' | 'pending' | 'conflict'

// progress_records وevaluations منفصلان بالخادم (عبر progress_record_id)،
// لكن هنا مدمجان بصف واحد مسطّح — لأن هذا بالضبط الشكل الذي تستهلكه
// الواجهة (نفس الجدول الموحّد المبني بالفعل)، فلا حاجة لـ join محلي.

export interface LocalStudent {
  id: string
  national_id: string
  first_name: string
  father_name: string
  grandfather_name: string
  family_name: string
  birth_date: string
  phone: string
  center_id: string
  teacher_id: string
  created_at: string
  deletion_requested_at: string | null
  deletion_requested_by: string | null
  syncStatus: SyncStatus
  syncError: string | null
}

export interface LocalProgressRecord {
  id: string
  student_id: string
  teacher_id: string
  date: string
  surah: string
  from_ayah: number
  to_ayah: number
  notes: string | null
  record_type: string
  rating: number | null
  created_at: string
  syncStatus: SyncStatus
  syncError: string | null
}

export type OutboxOperation =
  | 'create_student_with_parent'
  | 'update_student'
  | 'add_progress_with_evaluation'
  | 'update_progress_with_evaluation'
  | 'delete_progress'
  | 'delete_student'
  | 'request_student_deletion'
  | 'cancel_student_deletion_request'

export type OutboxStatus = 'pending' | 'syncing' | 'failed'

export interface OutboxItem {
  localId?: number
  entityId: string
  entityTable: 'students' | 'progressRecords'
  operation: OutboxOperation
  payload: Record<string, unknown>
  status: OutboxStatus
  attempts: number
  lastError: string | null
  createdAt: number
}

export interface TeacherProfileMeta {
  teacherId: string
  centerId: string
  fullName: string
}

interface MetaRow {
  key: string
  value: unknown
}

export class HifzTeacherDB extends Dexie {
  students!: Table<LocalStudent, string>
  progressRecords!: Table<LocalProgressRecord, string>
  outbox!: Table<OutboxItem, number>
  meta!: Table<MetaRow, string>

  constructor(teacherId: string) {
    // اسم القاعدة يتضمن معرّف المحفظ عمدًا — على جهاز مشترك بين أكثر من
    // محفظ، تبقى بيانات كل واحد منعزلة تمامًا في قاعدة IndexedDB خاصة به،
    // بلا أي احتمال تداخل أو حاجة لمسح بيانات محفظ آخر عند تبديل الجلسة.
    super(`hifz-teacher-db-${teacherId}`)
    this.version(1).stores({
      // created_at مُضاف للفهرس عمدًا لأن StudentsSection يستخدم
      // db.students.orderBy('created_at') — Dexie.orderBy() يتطلب أن يكون
      // الحقل مفهرسًا فعليًا وإلا يرمي DexieError عند التنفيذ مباشرة (هذا
      // بالضبط ما كان يُسبِّب الصفحة البيضاء).
      students: 'id, national_id, center_id, teacher_id, syncStatus, created_at',
      progressRecords: 'id, student_id, date, syncStatus',
      outbox: '++localId, entityId, status, createdAt',
      meta: 'key',
    })
  }
}

const openDatabases = new Map<string, HifzTeacherDB>()

export function getDb(teacherId: string): HifzTeacherDB {
  let instance = openDatabases.get(teacherId)
  if (!instance) {
    instance = new HifzTeacherDB(teacherId)
    openDatabases.set(teacherId, instance)
  }
  return instance
}

export async function getTeacherProfile(
  database: HifzTeacherDB,
): Promise<TeacherProfileMeta | null> {
  const row = await database.meta.get('teacherProfile')
  return (row?.value as TeacherProfileMeta | undefined) ?? null
}

export async function setTeacherProfile(
  database: HifzTeacherDB,
  profile: TeacherProfileMeta,
): Promise<void> {
  await database.meta.put({ key: 'teacherProfile', value: profile })
}

export async function getLastPulledAt(database: HifzTeacherDB): Promise<number | null> {
  const row = await database.meta.get('lastPulledAt')
  return (row?.value as number | undefined) ?? null
}

export async function setLastPulledAt(
  database: HifzTeacherDB,
  timestamp: number,
): Promise<void> {
  await database.meta.put({ key: 'lastPulledAt', value: timestamp })
}

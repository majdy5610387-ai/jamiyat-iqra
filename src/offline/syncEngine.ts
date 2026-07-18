import { getDb, type OutboxItem } from './db'
import { pullLatestData } from './pull'
import { getStoredCustomSession } from '../auth/customAuth'
import { createCustomAuthClient } from '../supabase/authenticatedClient'
import { TABLES } from '../supabase/tables'

const MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE = 5
const PERIODIC_INTERVAL_MS = 45_000

// قفل تزامن بسيط بالذاكرة (لكل محفظ) — يمنع تشغيل دورتي مزامنة متزامنتين
// (لو أُطلق حدث online والمؤقّت الدوري بنفس اللحظة تقريبًا).
const activeSyncs = new Set<string>()
let engineStarted = false

type ErrorClass = 'transient' | 'permanent'

// يميّز بين خطأ مؤقت (يستحق إعادة محاولة تلقائية) وخطأ دائم/تعارض بيانات
// (إعادة نفس الطلب لن تنجح أبدًا، يجب إيقافه وعرضه للمحفظ).
function classifyError(error: unknown): ErrorClass {
  if (!error || typeof error !== 'object') return 'transient'

  const code = (error as { code?: string }).code
  // 23505 = تكرار قيمة فريدة (رقم هوية مثلًا)، 23503 = خرق مفتاح خارجي،
  // 42501 = رفض صلاحية (RLS) — كلها أخطاء لن تُحلّ بإعادة نفس الطلب.
  if (code === '23505' || code === '23503' || code === '42501') {
    return 'permanent'
  }

  const status = (error as { status?: number }).status
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return 'permanent'
  }

  return 'transient'
}

async function executeOperation(
  client: ReturnType<typeof createCustomAuthClient>,
  item: OutboxItem,
): Promise<{ error: unknown }> {
  switch (item.operation) {
    case 'create_student_with_parent':
      return await client.rpc('create_student_with_parent', item.payload)
    case 'update_student': {
      const { id, ...changes } = item.payload as { id: string; [key: string]: unknown }
      const result = await client.from(TABLES.students).update(changes).eq('id', id)
      return { error: result.error }
    }
    case 'add_progress_with_evaluation':
      return await client.rpc('add_progress_with_evaluation', item.payload)
    case 'update_progress_with_evaluation':
      return await client.rpc('update_progress_with_evaluation', item.payload)
    case 'delete_student':
      return await client.rpc('delete_student', item.payload)
    case 'request_student_deletion':
      return await client.rpc('request_student_deletion', item.payload)
    case 'cancel_student_deletion_request':
      return await client.rpc('cancel_student_deletion_request', item.payload)
    case 'delete_progress': {
      const progressId = (item.payload as { p_progress_id: string }).p_progress_id
      const result = await client.from(TABLES.progressRecords).delete().eq('id', progressId)
      return { error: result.error }
    }
    default:
      return { error: new Error('عملية outbox غير معروفة') }
  }
}

async function markEntitySynced(
  db: ReturnType<typeof getDb>,
  item: OutboxItem,
): Promise<void> {
  if (item.entityTable === 'students') {
    await db.students.update(item.entityId, { syncStatus: 'synced', syncError: null })
  } else {
    await db.progressRecords.update(item.entityId, { syncStatus: 'synced', syncError: null })
  }
}

async function markEntityConflict(
  db: ReturnType<typeof getDb>,
  item: OutboxItem,
  message: string,
): Promise<void> {
  if (item.entityTable === 'students') {
    await db.students.update(item.entityId, { syncStatus: 'conflict', syncError: message })
  } else {
    await db.progressRecords.update(item.entityId, { syncStatus: 'conflict', syncError: message })
  }
}

async function runSync(teacherId: string): Promise<void> {
  if (activeSyncs.has(teacherId)) return
  activeSyncs.add(teacherId)

  try {
    const session = getStoredCustomSession()
    // تحقق أن الجلسة الحالية فعليًا لنفس المحفظ الذي نُزامن قاعدته — مهم
    // على جهاز مشترك بين أكثر من محفظ (لا نستخدم أبدًا توكن محفظ آخر
    // لمزامنة outbox محفظ سابق لم يُسجَّل خروجه بشكل نظيف).
    if (!session || session.app_role !== 'teacher' || session.sub !== teacherId) {
      return
    }
    if (!navigator.onLine) {
      return
    }

    const db = getDb(teacherId)
    const client = createCustomAuthClient(session.access_token)

    // معالجة تسلسلية بترتيب الإنشاء (FIFO) — إجبارية: عمليات لاحقة قد
    // تعتمد على نجاح سابقة (تعديل سجل لطالب أُنشئ للتو محليًا يتطلب مزامنة
    // إنشاء الطالب أولًا).
    const items = await db.outbox.where('status').equals('pending').sortBy('createdAt')
    let hadTransientBreak = false

    for (const item of items) {
      if (!navigator.onLine) {
        hadTransientBreak = true
        break
      }

      await db.outbox.update(item.localId!, { status: 'syncing' })

      const { error } = await executeOperation(client, item)

      if (!error) {
        await db.outbox.delete(item.localId!)
        await markEntitySynced(db, item)
        continue
      }

      const errorClass = classifyError(error)
      const message = (error as { message?: string })?.message ?? 'خطأ غير معروف'
      const nextAttempts = item.attempts + 1

      if (errorClass === 'permanent' || nextAttempts >= MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE) {
        // خطأ دائم (أو استُنفدت المحاولات لخطأ غير مصنَّف بوضوح): نوقف إعادة
        // المحاولة التلقائية لهذا العنصر تحديدًا ونعرضه للمحفظ، لكن نتابع
        // لبقية عناصر الطابور (قد تكون مستقلة تمامًا عن هذا التعارض).
        await db.outbox.update(item.localId!, {
          status: 'failed',
          attempts: nextAttempts,
          lastError: message,
        })
        await markEntityConflict(db, item, message)
        continue
      }

      // خطأ مؤقت: نوقف معالجة بقية القائمة بهذه الدورة (على الأغلب مشكلة
      // اتصال عامة، لا فائدة من محاولة بقية العناصر بنفس اللحظة) — ستُعاد
      // محاولة القائمة كاملة بالدورة القادمة (حدث online أو المؤقّت الدوري).
      await db.outbox.update(item.localId!, {
        status: 'pending',
        attempts: nextAttempts,
        lastError: message,
      })
      hadTransientBreak = true
      break
    }

    // نسحب أحدث بيانات المركز بعد كل دورة اكتملت بلا توقف بسبب خطأ مؤقت
    // (بما فيها الدورات التي لم يكن بها شيء لدفعه أصلًا) — هذا يلتقط
    // تعديلات محفظين آخرين لنفس المركز بشكل دوري تلقائي.
    if (!hadTransientBreak) {
      await pullLatestData(teacherId)
    }
  } finally {
    activeSyncs.delete(teacherId)
  }
}

// يُستدعى من repository.ts فور أي كتابة محلية جديدة (محاولة مزامنة فورية،
// دون انتظار).
export function triggerSync(teacherId: string): void {
  void runSync(teacherId)
}

function handleAmbientTrigger(): void {
  const session = getStoredCustomSession()
  if (session && session.app_role === 'teacher') {
    void runSync(session.sub)
  }
}

// يُستدعى مرة واحدة فقط عند بدء التطبيق (من AuthProvider) — يُفعّل حدث
// online والمؤقّت الدوري.
export function startSyncEngine(): void {
  if (engineStarted) return
  engineStarted = true

  window.addEventListener('online', handleAmbientTrigger)
  setInterval(handleAmbientTrigger, PERIODIC_INTERVAL_MS)

  // محاولة فورية عند بدء التشغيل لو كان متصلًا بالفعل أصلًا
  handleAmbientTrigger()
}

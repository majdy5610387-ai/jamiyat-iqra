import { getDb, type LocalProgressRecord, type LocalStudent, type OutboxItem } from './db'
import { triggerSync } from './syncEngine'

function newOutboxItem(
  entry: Omit<OutboxItem, 'localId' | 'status' | 'attempts' | 'lastError' | 'createdAt'>,
): Omit<OutboxItem, 'localId'> {
  return {
    ...entry,
    status: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  }
}

// "لم يُزامَن بعد بنجاح إطلاقًا" تعني: لا يزال هناك عنصر outbox لعملية
// الإنشاء الأصلية لهذا الكيان، بغضّ النظر هل حالته pending (لم تُحاوَل بعد
// أو تنتظر الدورة القادمة) أو failed (تعارض دائم) — كلاهما "لم يُزامَن".
// (لا توجد حالة outbox اسمها "synced" أصلًا: النجاح يعني حذف العنصر كليًا.)
function isUnsyncedStatus(status: OutboxItem['status']): boolean {
  return status === 'pending' || status === 'failed'
}

// ------------------------------------------------------------
// الطلاب
// ------------------------------------------------------------

interface AddStudentInput {
  teacherId: string
  centerId: string
  nationalId: string
  firstName: string
  fatherName: string
  grandfatherName: string
  familyName: string
  birthDate: string
  phone: string
}

export async function addStudent(input: AddStudentInput): Promise<string> {
  const db = getDb(input.teacherId)
  const id = crypto.randomUUID()

  const localStudent: LocalStudent = {
    id,
    national_id: input.nationalId,
    first_name: input.firstName,
    father_name: input.fatherName,
    grandfather_name: input.grandfatherName,
    family_name: input.familyName,
    birth_date: input.birthDate,
    phone: input.phone,
    center_id: input.centerId,
    teacher_id: input.teacherId,
    created_at: new Date().toISOString(),
    deletion_requested_at: null,
    deletion_requested_by: null,
    syncStatus: 'pending',
    syncError: null,
  }

  await db.transaction('rw', db.students, db.outbox, async () => {
    await db.students.add(localStudent)
    await db.outbox.add(
      newOutboxItem({
        entityId: id,
        entityTable: 'students',
        operation: 'create_student_with_parent',
        payload: {
          p_student_id: id,
          p_national_id: input.nationalId,
          p_first_name: input.firstName,
          p_father_name: input.fatherName,
          p_grandfather_name: input.grandfatherName,
          p_family_name: input.familyName,
          p_birth_date: input.birthDate,
          p_phone: input.phone,
          p_center_id: input.centerId,
          p_teacher_id: input.teacherId,
        },
      }),
    )
  })

  triggerSync(input.teacherId)
  return id
}

interface UpdateStudentInput {
  teacherId: string
  studentId: string
  firstName: string
  fatherName: string
  grandfatherName: string
  familyName: string
  birthDate: string
  phone: string
}

// ملاحظة: رقم الهوية عمدًا غير قابل للتعديل هنا — هو نفسه اسم مستخدم/كلمة
// مرور حساب ولي الأمر المرتبط، وتغييره بعد إنشاء الحساب يُحدث تعارضًا بين
// الاثنين. لو احتجت تغييره فعليًا، يلزم حذف الطالب وإضافته من جديد.
export async function updateStudent(input: UpdateStudentInput): Promise<void> {
  const db = getDb(input.teacherId)

  await db.transaction('rw', db.students, db.outbox, async () => {
    const existing = await db.students.get(input.studentId)
    if (!existing) return

    await db.students.put({
      ...existing,
      first_name: input.firstName,
      father_name: input.fatherName,
      grandfather_name: input.grandfatherName,
      family_name: input.familyName,
      birth_date: input.birthDate,
      phone: input.phone,
      syncStatus: 'pending',
      syncError: null,
    })

    // لو الإنشاء الأصلي لم يُزامَن بنجاح بعد (pending أو failed)، عدّل
    // حمولته مباشرة وأعد ضبط حالته لـ pending (يمنح تعارضًا سابقًا محاولة
    // جديدة ببيانات مصحَّحة) — بدل إضافة عملية تعديل منفصلة لا معنى لها
    // لكيان لم يُنشأ بالخادم أصلًا بعد.
    const pendingCreate = await db.outbox
      .where('entityId')
      .equals(input.studentId)
      .and((item) => isUnsyncedStatus(item.status) && item.operation === 'create_student_with_parent')
      .first()

    if (pendingCreate) {
      await db.outbox.update(pendingCreate.localId!, {
        status: 'pending',
        lastError: null,
        payload: {
          ...pendingCreate.payload,
          p_first_name: input.firstName,
          p_father_name: input.fatherName,
          p_grandfather_name: input.grandfatherName,
          p_family_name: input.familyName,
          p_birth_date: input.birthDate,
          p_phone: input.phone,
        },
      })
    } else {
      await db.outbox.add(
        newOutboxItem({
          entityId: input.studentId,
          entityTable: 'students',
          operation: 'update_student',
          payload: {
            id: input.studentId,
            first_name: input.firstName,
            father_name: input.fatherName,
            grandfather_name: input.grandfatherName,
            family_name: input.familyName,
            birth_date: input.birthDate,
            phone: input.phone,
          },
        }),
      )
    }
  })

  triggerSync(input.teacherId)
}

// ملاحظة: المحفظ لم يعد يملك صلاحية حذف طالب فعليًا من الخادم (يتطلب الآن
// موافقة سوبر أدمن عبر request_student_deletion/DeletionRequestsSection —
// انظر requestStudentDeletion أدناه). بقيت هذه الدالة فقط للاستخدام الداخلي
// من discardFailedEntity (SyncIssuesPanel): تصريف/تنظيف محلي بحت لكيان لم
// يُزامَن أصلًا (غالبًا إنشاء فشل نهائيًا)، دون أي محاولة حذف بالخادم.
export async function deleteStudent(teacherId: string, studentId: string): Promise<void> {
  const db = getDb(teacherId)

  await db.transaction('rw', db.students, db.progressRecords, db.outbox, async () => {
    // ألغِ أي عناصر outbox معلّقة/فاشلة تخص سجلات حفظ هذا الطالب أولًا
    const relatedProgressIds = await db.progressRecords
      .where('student_id')
      .equals(studentId)
      .primaryKeys()

    for (const progressId of relatedProgressIds) {
      const items = await db.outbox.where('entityId').equals(progressId).toArray()
      for (const item of items) {
        await db.outbox.delete(item.localId!)
      }
    }

    // ألغِ كل عناصر outbox المتعلقة بهذا الطالب نفسه (إنشاء/تعديل/طلب حذف
    // معلّق) — تصريف محلي بحت، لا نُنشئ أي عملية حذف جديدة بالخادم (المحفظ
    // لم يعد يملك هذه الصلاحية أصلًا).
    const relatedItems = await db.outbox.where('entityId').equals(studentId).toArray()
    for (const item of relatedItems) {
      await db.outbox.delete(item.localId!)
    }

    await db.progressRecords.where('student_id').equals(studentId).delete()
    await db.students.delete(studentId)
  })

  triggerSync(teacherId)
}

// ------------------------------------------------------------
// طلب/إلغاء حذف الطالب (بانتظار موافقة سوبر أدمن)
// ------------------------------------------------------------

export async function requestStudentDeletion(teacherId: string, studentId: string): Promise<void> {
  const db = getDb(teacherId)

  await db.transaction('rw', db.students, db.outbox, async () => {
    const existing = await db.students.get(studentId)
    if (!existing) return

    await db.students.put({
      ...existing,
      deletion_requested_at: new Date().toISOString(),
      deletion_requested_by: teacherId,
    })

    // لو كان هناك "إلغاء طلب" معلّق سابق لم يُزامَن بعد، هو الآن متناقض مع
    // هذا الطلب الجديد — نحذفه بدل إرسال عمليتين متضادتين للخادم
    const pendingCancel = await db.outbox
      .where('entityId')
      .equals(studentId)
      .and(
        (item) =>
          isUnsyncedStatus(item.status) && item.operation === 'cancel_student_deletion_request',
      )
      .first()

    if (pendingCancel) {
      await db.outbox.delete(pendingCancel.localId!)
    } else {
      await db.outbox.add(
        newOutboxItem({
          entityId: studentId,
          entityTable: 'students',
          operation: 'request_student_deletion',
          payload: { p_student_id: studentId },
        }),
      )
    }
  })

  triggerSync(teacherId)
}

export async function cancelStudentDeletionRequest(
  teacherId: string,
  studentId: string,
): Promise<void> {
  const db = getDb(teacherId)

  await db.transaction('rw', db.students, db.outbox, async () => {
    const existing = await db.students.get(studentId)
    if (!existing) return

    await db.students.put({
      ...existing,
      deletion_requested_at: null,
      deletion_requested_by: null,
    })

    // لو كان هناك "طلب حذف" معلّق سابق لم يُزامَن بعد، هو الآن متناقض مع
    // هذا الإلغاء — نحذفه بدل إرسال عمليتين متضادتين للخادم
    const pendingRequest = await db.outbox
      .where('entityId')
      .equals(studentId)
      .and(
        (item) => isUnsyncedStatus(item.status) && item.operation === 'request_student_deletion',
      )
      .first()

    if (pendingRequest) {
      await db.outbox.delete(pendingRequest.localId!)
    } else {
      await db.outbox.add(
        newOutboxItem({
          entityId: studentId,
          entityTable: 'students',
          operation: 'cancel_student_deletion_request',
          payload: { p_student_id: studentId },
        }),
      )
    }
  })

  triggerSync(teacherId)
}

// ------------------------------------------------------------
// سجلات الحفظ والتقييمات (مدمجة بصف واحد محليًا)
// ------------------------------------------------------------

interface AddProgressInput {
  teacherId: string
  studentId: string
  date: string
  surah: string
  fromAyah: number
  toAyah: number
  notes: string | null
  rating: number | null
  recordType: string
}

export async function addProgress(input: AddProgressInput): Promise<string> {
  const db = getDb(input.teacherId)
  const id = crypto.randomUUID()

  const localRecord: LocalProgressRecord = {
    id,
    student_id: input.studentId,
    teacher_id: input.teacherId,
    date: input.date,
    surah: input.surah,
    from_ayah: input.fromAyah,
    to_ayah: input.toAyah,
    notes: input.notes,
    record_type: input.recordType,
    rating: input.rating,
    created_at: new Date().toISOString(),
    syncStatus: 'pending',
    syncError: null,
  }

  await db.transaction('rw', db.progressRecords, db.outbox, async () => {
    await db.progressRecords.add(localRecord)
    await db.outbox.add(
      newOutboxItem({
        entityId: id,
        entityTable: 'progressRecords',
        operation: 'add_progress_with_evaluation',
        payload: {
          p_progress_id: id,
          p_student_id: input.studentId,
          p_teacher_id: input.teacherId,
          p_date: input.date,
          p_surah: input.surah,
          p_from_ayah: input.fromAyah,
          p_to_ayah: input.toAyah,
          p_notes: input.notes,
          p_rating: input.rating,
          p_record_type: input.recordType,
        },
      }),
    )
  })

  triggerSync(input.teacherId)
  return id
}

interface UpdateProgressInput {
  teacherId: string
  progressId: string
  date: string
  surah: string
  fromAyah: number
  toAyah: number
  notes: string | null
  rating: number | null
  recordType: string
}

export async function updateProgress(input: UpdateProgressInput): Promise<void> {
  const db = getDb(input.teacherId)

  await db.transaction('rw', db.progressRecords, db.outbox, async () => {
    const existing = await db.progressRecords.get(input.progressId)
    if (!existing) return

    await db.progressRecords.put({
      ...existing,
      date: input.date,
      surah: input.surah,
      from_ayah: input.fromAyah,
      to_ayah: input.toAyah,
      notes: input.notes,
      record_type: input.recordType,
      rating: input.rating,
      syncStatus: 'pending',
      syncError: null,
    })

    const pendingCreate = await db.outbox
      .where('entityId')
      .equals(input.progressId)
      .and(
        (item) => isUnsyncedStatus(item.status) && item.operation === 'add_progress_with_evaluation',
      )
      .first()

    if (pendingCreate) {
      await db.outbox.update(pendingCreate.localId!, {
        status: 'pending',
        lastError: null,
        payload: {
          ...pendingCreate.payload,
          p_date: input.date,
          p_surah: input.surah,
          p_from_ayah: input.fromAyah,
          p_to_ayah: input.toAyah,
          p_notes: input.notes,
          p_rating: input.rating,
          p_record_type: input.recordType,
        },
      })
    } else {
      await db.outbox.add(
        newOutboxItem({
          entityId: input.progressId,
          entityTable: 'progressRecords',
          operation: 'update_progress_with_evaluation',
          payload: {
            p_progress_id: input.progressId,
            p_date: input.date,
            p_surah: input.surah,
            p_from_ayah: input.fromAyah,
            p_to_ayah: input.toAyah,
            p_notes: input.notes,
            p_rating: input.rating,
            p_record_type: input.recordType,
          },
        }),
      )
    }
  })

  triggerSync(input.teacherId)
}

export async function deleteProgress(teacherId: string, progressId: string): Promise<void> {
  const db = getDb(teacherId)

  await db.transaction('rw', db.progressRecords, db.outbox, async () => {
    const pendingCreate = await db.outbox
      .where('entityId')
      .equals(progressId)
      .and(
        (item) => isUnsyncedStatus(item.status) && item.operation === 'add_progress_with_evaluation',
      )
      .first()

    if (pendingCreate) {
      await db.outbox.delete(pendingCreate.localId!)
    } else {
      const pendingUpdates = await db.outbox
        .where('entityId')
        .equals(progressId)
        .and(
          (item) =>
            isUnsyncedStatus(item.status) && item.operation === 'update_progress_with_evaluation',
        )
        .toArray()
      for (const item of pendingUpdates) {
        await db.outbox.delete(item.localId!)
      }

      await db.outbox.add(
        newOutboxItem({
          entityId: progressId,
          entityTable: 'progressRecords',
          operation: 'delete_progress',
          payload: { p_progress_id: progressId },
        }),
      )
    }

    await db.progressRecords.delete(progressId)
  })

  triggerSync(teacherId)
}

// ------------------------------------------------------------
// مشاكل المزامنة (استرجاع/إعادة محاولة/تجاهل)
// ------------------------------------------------------------

export async function retryOutboxItem(teacherId: string, localId: number): Promise<void> {
  const db = getDb(teacherId)
  await db.outbox.update(localId, { status: 'pending', lastError: null })
  triggerSync(teacherId)
}

export async function discardFailedEntity(
  teacherId: string,
  entityTable: 'students' | 'progressRecords',
  entityId: string,
): Promise<void> {
  if (entityTable === 'students') {
    await deleteStudent(teacherId, entityId)
  } else {
    await deleteProgress(teacherId, entityId)
  }
}

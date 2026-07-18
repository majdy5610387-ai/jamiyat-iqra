import { useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'

type RestoreMode = 'merge' | 'replace'

const CONFIRM_PHRASE = 'أوافق على الاستعادة'

function timestampLabel(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export default function BackupRestoreSection() {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [mergeConfirmed, setMergeConfirmed] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null)

  async function handleExport() {
    setExportError(null)
    setExporting(true)
    try {
      const [centersRes, teachersRes, studentsRes, parentsRes, progressRes, evaluationsRes, managersRes, appUsersRes] =
        await Promise.all([
          supabase.from(TABLES.centers).select('*'),
          supabase.from(TABLES.teachers).select('*'),
          supabase.from(TABLES.students).select('*'),
          supabase.from(TABLES.parents).select('*'),
          supabase.from(TABLES.progressRecords).select('*'),
          supabase.from(TABLES.evaluations).select('*'),
          supabase.from(TABLES.managers).select('*'),
          supabase.rpc('export_app_users_for_backup'),
        ])

      const results = [
        centersRes,
        teachersRes,
        studentsRes,
        parentsRes,
        progressRes,
        evaluationsRes,
        managersRes,
        appUsersRes,
      ]
      const failed = results.find((r) => r.error)
      if (failed) {
        setExportError('تعذّر جلب بيانات النسخة الاحتياطية: ' + failed.error!.message)
        return
      }

      const backup = {
        exported_at: new Date().toISOString(),
        note_managers:
          'بيانات جدول المدراء هنا للمرجعية فقط ولا تُستعاد تلقائيًا عبر زر الاستعادة، لأنها مرتبطة بحسابات Supabase Auth التي لا يمكن إعادة إنشائها بنفس المعرّفات. عند النقل لمشروع جديد يجب إنشاء حسابات المدراء يدويًا من قسم "المدراء".',
        centers: centersRes.data,
        teachers: teachersRes.data,
        students: studentsRes.data,
        parents: parentsRes.data,
        progress_records: progressRes.data,
        evaluations: evaluationsRes.data,
        managers: managersRes.data,
        app_users: appUsersRes.data,
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `نسخة-احتياطية-${timestampLabel()}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('حدث خطأ غير متوقع أثناء التصدير')
    } finally {
      setExporting(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
    setRestoreError(null)
    setRestoreSuccess(null)
  }

  function handleModeChange(newMode: RestoreMode) {
    setMode(newMode)
    // إعادة ضبط التأكيد عند تبديل الوضع، حتى لا ينتقل تأكيد وضع لآخر بالخطأ
    setMergeConfirmed(false)
    setConfirmText('')
    setRestoreError(null)
  }

  async function handleRestore(event: FormEvent) {
    event.preventDefault()
    setRestoreError(null)
    setRestoreSuccess(null)

    if (!file) {
      setRestoreError('يرجى اختيار ملف النسخة الاحتياطية (JSON) أولًا')
      return
    }
    if (mode === 'merge' && !mergeConfirmed) {
      setRestoreError('يرجى تأكيد الموافقة على تنفيذ عملية الدمج')
      return
    }
    if (mode === 'replace' && confirmText !== CONFIRM_PHRASE) {
      setRestoreError(`يرجى كتابة عبارة التأكيد بالضبط: "${CONFIRM_PHRASE}"`)
      return
    }

    setRestoring(true)
    try {
      let backup: unknown
      try {
        backup = JSON.parse(await file.text())
      } catch {
        setRestoreError('ملف النسخة الاحتياطية غير صالح: تعذّر قراءته كـ JSON')
        return
      }

      const { error } = await supabase.rpc('restore_backup', {
        p_backup: backup,
        p_mode: mode,
      })

      if (error) {
        setRestoreError('فشلت عملية الاستعادة: ' + error.message)
        return
      }

      setRestoreSuccess(
        mode === 'replace'
          ? 'تم استبدال كل البيانات ببيانات النسخة الاحتياطية بنجاح.'
          : 'تم دمج بيانات النسخة الاحتياطية بنجاح.',
      )
      setFile(null)
      setMergeConfirmed(false)
      setConfirmText('')
    } catch {
      setRestoreError('حدث خطأ غير متوقع أثناء الاستعادة')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <section className="section-card">
      <h2>النسخ الاحتياطي والاستعادة</h2>

      <div>
        <h3>تصدير نسخة احتياطية</h3>
        <p className="loading-text">
          يُصدّر ملف JSON واحد يحتوي كل بيانات النظام (المراكز، المحفظون، الطلاب، أولياء
          الأمور، سجلات الحفظ، التقييمات، المدراء، وحسابات الدخول بما فيها كلمات المرور
          المشفّرة) ويُحمَّل مباشرة لجهازك.
        </p>
        <button type="button" className="logout-button" onClick={handleExport} disabled={exporting}>
          {exporting ? 'جاري التصدير...' : 'تصدير نسخة احتياطية'}
        </button>
        {exportError && <p className="form-error">{exportError}</p>}
      </div>

      <hr />

      <div>
        <h3>استعادة من نسخة احتياطية</h3>
        <p className="form-error">
          تحذير: عملية الاستعادة تُعدّل البيانات مباشرة ولا يمكن التراجع عنها. يُنصح بشدة
          بأخذ نسخة احتياطية جديدة قبل تنفيذ أي استعادة، حتى تتمكن من الرجوع لحالة النظام
          الحالية عند الحاجة.
        </p>
        <p className="loading-text">
          ملاحظة: بيانات جدول المدراء الموجودة داخل الملف لا تُستعاد تلقائيًا مهما كان
          الوضع المختار، لأنها مرتبطة بحسابات Supabase Auth التي لا يمكن إعادة إنشائها
          بنفس المعرّفات. عند الحاجة لاستعادتها (مثلًا عند النقل لمشروع جديد) يجب إنشاء
          حسابات المدراء يدويًا من قسم "المدراء" بالاعتماد على الملف كمرجع فقط.
        </p>

        <form className="inline-form" onSubmit={handleRestore}>
          <div className="form-field">
            <label htmlFor="backup-file">ملف النسخة الاحتياطية (JSON)</label>
            <input id="backup-file" type="file" accept="application/json,.json" onChange={handleFileChange} />
          </div>

          <div className="form-field">
            <label>
              <input
                type="radio"
                name="restore-mode"
                value="merge"
                checked={mode === 'merge'}
                onChange={() => handleModeChange('merge')}
              />
              {' '}دمج (Merge)
            </label>
            <p className="loading-text">
              يُدرج بيانات الملف ويحدّث الصفوف الموجودة بنفس المعرّف، دون حذف أي بيانات
              حالية غير موجودة بالملف. الخيار الأنسب لاسترجاع بيانات محذوفة بالخطأ.
            </p>

            <label>
              <input
                type="radio"
                name="restore-mode"
                value="replace"
                checked={mode === 'replace'}
                onChange={() => handleModeChange('replace')}
              />
              {' '}استبدال كامل (Replace)
            </label>
            <p className="loading-text">
              يحذف كل البيانات الحالية (عدا جدول المدراء) ثم يُدرج بيانات الملف فقط. الخيار
              الأنسب عند نقل النظام لمشروع Supabase جديد فارغ. يُفقد أي بيانات حالية غير
              موجودة بالملف نهائيًا.
            </p>
          </div>

          {mode === 'merge' ? (
            <div className="form-field">
              <label>
                <input
                  type="checkbox"
                  checked={mergeConfirmed}
                  onChange={(event) => setMergeConfirmed(event.target.checked)}
                />
                {' '}أوافق على تنفيذ عملية الدمج
              </label>
            </div>
          ) : (
            <div className="form-field">
              <label htmlFor="confirm-phrase">
                اكتب عبارة "{CONFIRM_PHRASE}" لتأكيد العملية
              </label>
              <input
                id="confirm-phrase"
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            className="add-button"
            disabled={
              restoring ||
              !file ||
              (mode === 'merge' ? !mergeConfirmed : confirmText !== CONFIRM_PHRASE)
            }
          >
            {restoring ? 'جاري الاستعادة...' : 'استعادة من نسخة احتياطية'}
          </button>

          {restoreError && <p className="form-error">{restoreError}</p>}
          {restoreSuccess && <p className="form-success">{restoreSuccess}</p>}
        </form>
      </div>
    </section>
  )
}

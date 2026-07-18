import { useState } from 'react'
import ExcelJS from 'exceljs'
import { supabase } from '../../supabase/client'
import { TABLES } from '../../supabase/tables'
import { getStudentFullName, type Center, type Student, type Teacher } from '../../types'
import { getRecordTypeLabel } from '../../constants/progressRecordType'

type TeacherWithCenter = Teacher & { center: { name: string } | null }
type StudentWithRelations = Student & {
  center: { name: string } | null
  teacher: { full_name: string } | null
}
type ProgressWithEvaluation = {
  student_id: string
  date: string
  surah: string
  from_ayah: number
  to_ayah: number
  notes: string | null
  record_type: string
  created_at: string
  evaluation: { rating: number } | null
}

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ExcelExportButton() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setError(null)
    setExporting(true)
    try {
      const [centersRes, teachersRes, studentsRes, progressRes] = await Promise.all([
        supabase.from(TABLES.centers).select('*').order('name'),
        supabase
          .from(TABLES.teachers)
          .select('*, center:centers(name)')
          .order('full_name'),
        supabase
          .from(TABLES.students)
          .select('*, center:centers(name), teacher:teachers!teacher_id(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from(TABLES.progressRecords)
          .select(
            'student_id, date, surah, from_ayah, to_ayah, notes, record_type, created_at, evaluation:evaluations(rating)',
          ),
      ])

      if (centersRes.error || teachersRes.error || studentsRes.error || progressRes.error) {
        setError('تعذّر جلب البيانات اللازمة للتصدير')
        return
      }

      const centers = (centersRes.data as Center[]) ?? []
      const teachers = (teachersRes.data as TeacherWithCenter[]) ?? []
      const students = (studentsRes.data as StudentWithRelations[]) ?? []
      const progressRecords = (progressRes.data as unknown as ProgressWithEvaluation[]) ?? []

      const studentCountByCenter = new Map<string, number>()
      for (const student of students) {
        studentCountByCenter.set(
          student.center_id,
          (studentCountByCenter.get(student.center_id) ?? 0) + 1,
        )
      }

      // ترتيب سجلات كل طالب من الأحدث للأقدم (تاريخ، ثم وقت الإنشاء كفاصل ثانوي)
      const progressByStudent = new Map<string, ProgressWithEvaluation[]>()
      for (const record of progressRecords) {
        const list = progressByStudent.get(record.student_id) ?? []
        list.push(record)
        progressByStudent.set(record.student_id, list)
      }
      for (const list of progressByStudent.values()) {
        list.sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? 1 : -1
          return a.created_at < b.created_at ? 1 : -1
        })
      }

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'نظام إدارة مراكز التحفيظ'
      workbook.created = new Date()

      const centersSheet = workbook.addWorksheet('المراكز')
      centersSheet.columns = [
        { header: 'الاسم', key: 'name', width: 30 },
        { header: 'العنوان', key: 'address', width: 30 },
        { header: 'عدد الطلاب', key: 'student_count', width: 15 },
        { header: 'تاريخ الإنشاء', key: 'created_at', width: 18 },
      ]
      for (const center of centers) {
        centersSheet.addRow({
          name: center.name,
          address: center.address || '—',
          student_count: studentCountByCenter.get(center.id) ?? 0,
          created_at: center.created_at?.slice(0, 10) || '—',
        })
      }

      const teachersSheet = workbook.addWorksheet('المحفظون')
      teachersSheet.columns = [
        { header: 'الاسم', key: 'name', width: 25 },
        { header: 'رقم الهوية', key: 'national_id', width: 18 },
        { header: 'الهاتف', key: 'phone', width: 18 },
        { header: 'المركز', key: 'center', width: 25 },
      ]
      for (const teacher of teachers) {
        teachersSheet.addRow({
          name: teacher.full_name,
          national_id: teacher.national_id,
          phone: teacher.phone || '—',
          center: teacher.center?.name || '—',
        })
      }

      const studentsSheet = workbook.addWorksheet('الطلاب')
      studentsSheet.columns = [
        { header: 'الاسم الرباعي', key: 'name', width: 30 },
        { header: 'رقم الهوية', key: 'national_id', width: 18 },
        { header: 'تاريخ الميلاد', key: 'birth_date', width: 15 },
        { header: 'رقم التواصل', key: 'phone', width: 18 },
        { header: 'المركز', key: 'center', width: 25 },
        { header: 'المحفظ', key: 'teacher', width: 25 },
      ]
      for (const student of students) {
        studentsSheet.addRow({
          name: getStudentFullName(student),
          national_id: student.national_id,
          birth_date: student.birth_date,
          phone: student.phone,
          center: student.center?.name || '—',
          teacher: student.teacher?.full_name || '—',
        })
      }

      const recordsSheet = workbook.addWorksheet('سجلات الحفظ')
      recordsSheet.columns = [
        { header: 'الاسم الرباعي', key: 'name', width: 30 },
        { header: 'رقم الهوية', key: 'national_id', width: 18 },
        { header: 'التاريخ', key: 'date', width: 14 },
        { header: 'السورة', key: 'surah', width: 20 },
        { header: 'من آية', key: 'from_ayah', width: 10 },
        { header: 'إلى آية', key: 'to_ayah', width: 10 },
        { header: 'حالة الحفظ', key: 'record_type', width: 14 },
        { header: 'التقييم', key: 'rating', width: 10 },
        { header: 'ملاحظات', key: 'notes', width: 30 },
      ]
      // ترتيب حسب الطالب أولًا (بنفس ترتيب ورقة "الطلاب")، وضمن كل طالب من
      // الأحدث للأقدم (مُرتَّبة مسبقًا بـ progressByStudent أعلاه)
      for (const student of students) {
        const records = progressByStudent.get(student.id) ?? []
        for (const record of records) {
          recordsSheet.addRow({
            name: getStudentFullName(student),
            national_id: student.national_id,
            date: record.date,
            surah: record.surah,
            from_ayah: record.from_ayah,
            to_ayah: record.to_ayah,
            record_type: getRecordTypeLabel(record.record_type),
            rating: record.evaluation?.rating ?? '—',
            notes: record.notes || '—',
          })
        }
      }

      for (const sheet of [centersSheet, teachersSheet, studentsSheet, recordsSheet]) {
        sheet.getRow(1).font = { bold: true }
        sheet.views = [{ rightToLeft: true }]
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `تقرير-النظام-${todayLabel()}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('حدث خطأ غير متوقع أثناء التصدير')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <button type="button" className="logout-button" onClick={handleExport} disabled={exporting}>
        {exporting ? 'جاري التصدير...' : 'تصدير إلى Excel'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

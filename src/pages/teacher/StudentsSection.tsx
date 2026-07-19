import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTeacherDb } from '../../offline/useTeacherDb'
import { getTeacherProfile, type LocalStudent } from '../../offline/db'
import {
  addStudent,
  updateStudent,
  requestStudentDeletion,
  cancelStudentDeletionRequest,
} from '../../offline/repository'
import { getLocalStudentFullName } from '../../offline/helpers'
import { isValidNationalId, sanitizeNationalIdInput, NATIONAL_ID_ERROR_MESSAGE } from '../../utils/nationalId'

export default function StudentsSection() {
  const db = useTeacherDb()

  const profile = useLiveQuery(() => (db ? getTeacherProfile(db) : null), [db])
  const students = useLiveQuery(
    () => (db ? db.students.orderBy('created_at').reverse().toArray() : []),
    [db],
  )

  const [firstName, setFirstName] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [grandfatherName, setGrandfatherName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editFatherName, setEditFatherName] = useState('')
  const [editGrandfatherName, setEditGrandfatherName] = useState('')
  const [editFamilyName, setEditFamilyName] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    if (
      !firstName.trim() ||
      !fatherName.trim() ||
      !grandfatherName.trim() ||
      !familyName.trim() ||
      !nationalId.trim() ||
      !birthDate ||
      !phone.trim()
    ) {
      setFormError('يرجى تعبئة جميع الحقول')
      return
    }

    if (!isValidNationalId(nationalId.trim())) {
      setFormError(NATIONAL_ID_ERROR_MESSAGE)
      return
    }

    if (!db || !profile) {
      setFormError('بيانات حسابك قيد التحميل، حاول بعد لحظات (يتطلب اتصالًا بالإنترنت أول مرة فقط)')
      return
    }

    const duplicateLocally = await db.students
      .where('national_id')
      .equals(nationalId.trim())
      .first()
    if (duplicateLocally) {
      setFormError('رقم الهوية هذا مضاف بالفعل على هذا الجهاز')
      return
    }

    setSubmitting(true)
    try {
      await addStudent({
        teacherId: profile.teacherId,
        centerId: profile.centerId,
        nationalId: nationalId.trim(),
        firstName: firstName.trim(),
        fatherName: fatherName.trim(),
        grandfatherName: grandfatherName.trim(),
        familyName: familyName.trim(),
        birthDate,
        phone: phone.trim(),
      })

      setFormSuccess(
        navigator.onLine
          ? `تم حفظ الطالب. اسم المستخدم وكلمة المرور لحساب ولي الأمر: ${nationalId.trim()}`
          : `تم حفظ بيانات الطالب محليًا. سيُنشأ حساب ولي الأمر تلقائيًا عند توفر الإنترنت — سيكون اسم المستخدم وكلمة المرور رقم الهوية: ${nationalId.trim()}`,
      )
      setFirstName('')
      setFatherName('')
      setGrandfatherName('')
      setFamilyName('')
      setNationalId('')
      setBirthDate('')
      setPhone('')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(student: LocalStudent) {
    setEditingId(student.id)
    setEditFirstName(student.first_name)
    setEditFatherName(student.father_name)
    setEditGrandfatherName(student.grandfather_name)
    setEditFamilyName(student.family_name)
    setEditBirthDate(student.birth_date)
    setEditPhone(student.phone)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(studentId: string) {
    if (!profile) return
    if (
      !editFirstName.trim() ||
      !editFatherName.trim() ||
      !editGrandfatherName.trim() ||
      !editFamilyName.trim() ||
      !editBirthDate ||
      !editPhone.trim()
    ) {
      return
    }

    setRowBusy(studentId)
    try {
      await updateStudent({
        teacherId: profile.teacherId,
        studentId,
        firstName: editFirstName.trim(),
        fatherName: editFatherName.trim(),
        grandfatherName: editGrandfatherName.trim(),
        familyName: editFamilyName.trim(),
        birthDate: editBirthDate,
        phone: editPhone.trim(),
      })
      setEditingId(null)
    } finally {
      setRowBusy(null)
    }
  }

  async function handleRequestDeletion(studentId: string) {
    if (!profile) return
    if (
      !window.confirm(
        'سيُرسل هذا طلب حذف لسوبر أدمن لاعتماده. لن يُحذف الطالب فورًا، ويمكنك إلغاء الطلب في أي وقت قبل موافقته.',
      )
    ) {
      return
    }

    setRowBusy(studentId)
    try {
      await requestStudentDeletion(profile.teacherId, studentId)
    } finally {
      setRowBusy(null)
    }
  }

  async function handleCancelDeletion(studentId: string) {
    if (!profile) return

    setRowBusy(studentId)
    try {
      await cancelStudentDeletionRequest(profile.teacherId, studentId)
    } finally {
      setRowBusy(null)
    }
  }

  const loading = students === undefined

  return (
    <section className="section-card">
      <h2>الطلاب</h2>

      {loading ? (
        <p className="loading-text">جاري التحميل...</p>
      ) : students!.length === 0 ? (
        <p className="empty-state">لا يوجد طلاب بعد.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>الاسم الرباعي</th>
              <th>رقم الهوية</th>
              <th>تاريخ الميلاد</th>
              <th>رقم التواصل</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students!.map((student) =>
              editingId === student.id ? (
                <tr key={student.id}>
                  <td data-label="الاسم الرباعي">
                    <div className="form-field">
                      <input
                        type="text"
                        placeholder="الاسم الأول"
                        value={editFirstName}
                        onChange={(event) => setEditFirstName(event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="اسم الأب"
                        value={editFatherName}
                        onChange={(event) => setEditFatherName(event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="اسم الجد"
                        value={editGrandfatherName}
                        onChange={(event) => setEditGrandfatherName(event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="اسم العائلة"
                        value={editFamilyName}
                        onChange={(event) => setEditFamilyName(event.target.value)}
                      />
                    </div>
                  </td>
                  <td data-label="رقم الهوية">{student.national_id}</td>
                  <td data-label="تاريخ الميلاد">
                    <input
                      type="date"
                      value={editBirthDate}
                      onChange={(event) => setEditBirthDate(event.target.value)}
                    />
                  </td>
                  <td data-label="رقم التواصل">
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                    />
                  </td>
                  <td data-label="الحالة">—</td>
                  <td className="data-table-actions">
                    <button
                      type="button"
                      className="detail-link"
                      disabled={rowBusy === student.id}
                      onClick={() => saveEdit(student.id)}
                    >
                      حفظ
                    </button>
                    {' | '}
                    <button type="button" className="detail-link" onClick={cancelEdit}>
                      إلغاء
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={student.id}>
                  <td data-label="الاسم الرباعي">{getLocalStudentFullName(student)}</td>
                  <td data-label="رقم الهوية">{student.national_id}</td>
                  <td data-label="تاريخ الميلاد">{student.birth_date}</td>
                  <td data-label="رقم التواصل">{student.phone}</td>
                  <td data-label="الحالة">
                    {student.deletion_requested_at && (
                      <span title="بانتظار موافقة السوبر أدمن على الحذف">⏳ بانتظار الحذف</span>
                    )}
                    {' '}
                    {student.syncStatus === 'synced' && <span title="تمت المزامنة">✅</span>}
                    {student.syncStatus === 'pending' && <span title="بانتظار الاتصال">🕓</span>}
                    {student.syncStatus === 'conflict' && (
                      <span title={student.syncError || 'تعذّرت المزامنة'}>⚠️ تعارض</span>
                    )}
                  </td>
                  <td className="data-table-actions">
                    <Link className="detail-link" to={`/teacher/students/${student.id}`}>
                      عرض التفاصيل
                    </Link>
                    {' | '}
                    <button
                      type="button"
                      className="detail-link"
                      onClick={() => startEdit(student)}
                    >
                      تعديل
                    </button>
                    {' | '}
                    {student.deletion_requested_at ? (
                      <button
                        type="button"
                        className="detail-link"
                        disabled={rowBusy === student.id}
                        onClick={() => handleCancelDeletion(student.id)}
                      >
                        إلغاء طلب الحذف
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="detail-link"
                        disabled={rowBusy === student.id}
                        onClick={() => handleRequestDeletion(student.id)}
                      >
                        طلب حذف
                      </button>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      <form className="inline-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="student-first-name">الاسم الأول</label>
          <input
            id="student-first-name"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="student-father-name">اسم الأب</label>
          <input
            id="student-father-name"
            type="text"
            value={fatherName}
            onChange={(event) => setFatherName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="student-grandfather-name">اسم الجد</label>
          <input
            id="student-grandfather-name"
            type="text"
            value={grandfatherName}
            onChange={(event) => setGrandfatherName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="student-family-name">اسم العائلة</label>
          <input
            id="student-family-name"
            type="text"
            value={familyName}
            onChange={(event) => setFamilyName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="student-national-id">رقم الهوية</label>
          <input
            id="student-national-id"
            type="text"
            inputMode="numeric"
            maxLength={9}
            value={nationalId}
            onChange={(event) => setNationalId(sanitizeNationalIdInput(event.target.value))}
          />
        </div>
        <div className="form-field">
          <label htmlFor="student-birth-date">تاريخ الميلاد</label>
          <input
            id="student-birth-date"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="student-phone">رقم التواصل</label>
          <input
            id="student-phone"
            type="text"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <button type="submit" className="add-button" disabled={submitting}>
          {submitting ? 'جاري الحفظ...' : 'إضافة طالب'}
        </button>
        {formError && <p className="form-error">{formError}</p>}
        {formSuccess && <p className="form-success">{formSuccess}</p>}
      </form>
    </section>
  )
}

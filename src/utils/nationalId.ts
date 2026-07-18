export const NATIONAL_ID_LENGTH = 9

const NATIONAL_ID_PATTERN = /^[0-9]{9}$/

export const NATIONAL_ID_ERROR_MESSAGE = `رقم الهوية يجب أن يتكون من ${NATIONAL_ID_LENGTH} أرقام بالضبط، بدون حروف أو رموز`

export function isValidNationalId(value: string): boolean {
  return NATIONAL_ID_PATTERN.test(value)
}

// تُستخدم بمعالج onChange: تحذف أي حرف غير رقمي وتقصّ الطول عند 9 خانات،
// فتمنع الكتابة أو اللصق غير الصحيح لحظيًا قبل وصوله لحالة النموذج أصلًا.
export function sanitizeNationalIdInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, NATIONAL_ID_LENGTH)
}

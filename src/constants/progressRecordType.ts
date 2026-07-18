export type RecordType = 'new' | 'review'

export const RECORD_TYPE_OPTIONS: { value: RecordType; label: string }[] = [
  { value: 'new', label: 'حفظ جديد' },
  { value: 'review', label: 'مراجعة' },
]

export function getRecordTypeLabel(value: string): string {
  return RECORD_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

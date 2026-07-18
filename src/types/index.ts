export type UserRole = 'manager' | 'teacher' | 'parent'

export interface Center {
  id: string
  name: string
  address: string | null
  created_at: string
}

export interface Manager {
  id: string
  full_name: string
  email: string
  is_super_admin: boolean
  created_at: string
}

export interface Teacher {
  id: string
  full_name: string
  national_id: string
  phone: string | null
  center_id: string
  created_at: string
}

export interface Student {
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
  updated_at: string
  deletion_requested_at: string | null
  deletion_requested_by: string | null
}

export interface ParentAccount {
  id: string
  student_id: string
  national_id: string
  created_at: string
}

export interface ProgressRecord {
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
}

export interface Evaluation {
  id: string
  student_id: string
  teacher_id: string
  date: string
  rating: number
  notes: string | null
  created_at: string
}

export function getStudentFullName(student: Student): string {
  return `${student.first_name} ${student.father_name} ${student.grandfather_name} ${student.family_name}`
}

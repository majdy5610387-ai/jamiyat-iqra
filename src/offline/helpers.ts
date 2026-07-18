import type { LocalStudent } from './db'

export function getLocalStudentFullName(student: LocalStudent): string {
  return `${student.first_name} ${student.father_name} ${student.grandfather_name} ${student.family_name}`
}

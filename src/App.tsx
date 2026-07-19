import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import LoginSelect from './pages/login/LoginSelect'
import ManagerLogin from './pages/login/ManagerLogin'
import TeacherLogin from './pages/login/TeacherLogin'
import ParentLogin from './pages/login/ParentLogin'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import CentersPage from './pages/manager/CentersPage'
import TeachersPage from './pages/manager/TeachersPage'
import StudentsManagementPage from './pages/manager/StudentsManagementPage'
import ManagersPage from './pages/manager/ManagersPage'
import DeletionRequestsPage from './pages/manager/DeletionRequestsPage'
import BackupPage from './pages/manager/BackupPage'
import CenterStudents from './pages/manager/CenterStudents'
import ManagerStudentDetail from './pages/manager/ManagerStudentDetail'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import StudentDetail from './pages/teacher/StudentDetail'
import ParentDashboard from './pages/parent/ParentDashboard'
import ResetPassword from './pages/ResetPassword'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginSelect />} />
          <Route path="/login/manager" element={<ManagerLogin />} />
          <Route path="/login/teacher" element={<TeacherLogin />} />
          <Route path="/login/parent" element={<ParentLogin />} />
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/manager/centers" element={<CentersPage />} />
          <Route path="/manager/teachers" element={<TeachersPage />} />
          <Route path="/manager/students" element={<StudentsManagementPage />} />
          <Route path="/manager/managers" element={<ManagersPage />} />
          <Route path="/manager/deletion-requests" element={<DeletionRequestsPage />} />
          <Route path="/manager/backup" element={<BackupPage />} />
          <Route path="/manager/centers/:centerId" element={<CenterStudents />} />
          <Route path="/manager/students/:studentId" element={<ManagerStudentDetail />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/students/:studentId" element={<StudentDetail />} />
          <Route path="/parent" element={<ParentDashboard />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

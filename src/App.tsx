import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import LoginSelect from './pages/login/LoginSelect'
import ManagerLogin from './pages/login/ManagerLogin'
import TeacherLogin from './pages/login/TeacherLogin'
import ParentLogin from './pages/login/ParentLogin'
import ManagerDashboard from './pages/manager/ManagerDashboard'
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

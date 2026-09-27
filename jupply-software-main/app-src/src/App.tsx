import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './routes/RequireAuth'
import { AppShell } from './components/layout/AppShell'
import { Login } from './pages/Login'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/connexion" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route path="/stocks" element={<AppShell />} />
        </Route>

        <Route path="*" element={<Navigate to="/stocks" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App

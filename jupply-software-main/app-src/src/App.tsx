import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { EcranOuverture } from './components/layout/EcranOuverture'
import { RequireAuth } from './routes/RequireAuth'
import { AppShell } from './components/layout/AppShell'
import { Login } from './pages/Login'

/** Animation d'ouverture tant que la session et le profil se chargent. */
function Ouverture() {
  const { chargement } = useAuth()
  return <EcranOuverture pret={!chargement} />
}

function App() {
  return (
    <AuthProvider>
      <Ouverture />
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

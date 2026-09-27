import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth() {
  const { session, chargement } = useAuth()

  if (chargement) {
    return <div className="min-h-screen flex items-center justify-center bg-canvas text-sm text-text-muted">Chargement...</div>
  }

  if (!session) return <Navigate to="/connexion" replace />

  return <Outlet />
}

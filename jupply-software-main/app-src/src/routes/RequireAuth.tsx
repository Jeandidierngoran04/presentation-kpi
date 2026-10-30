import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth() {
  const { session, chargement } = useAuth()

  // Pendant le chargement, l'écran d'ouverture animé (App.tsx) recouvre tout.
  if (chargement) return null

  if (!session) return <Navigate to="/connexion" replace />

  return <Outlet />
}

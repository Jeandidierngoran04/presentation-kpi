import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export function Login() {
  const { session, connexion } = useAuth()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (session) return <Navigate to="/stocks" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const message = await connexion(email, motDePasse)
    setEnvoi(false)
    if (message) setErreur(message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <span className="font-bold text-accent-contrast text-lg">J</span>
          </div>
          <span className="font-semibold text-text text-lg">Jupply Software</span>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h1 className="text-lg font-semibold text-text mb-1">Connexion</h1>
          <p className="text-xs text-text-muted mb-6">Accédez à votre espace de gestion des stocks.</p>

          {!isSupabaseConfigured && (
            <div className="mb-4 text-xs bg-warn-soft text-warn-deep rounded-lg px-3 py-2.5">
              Supabase n'est pas encore configuré (clés manquantes dans .env.local).
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Adresse e-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="vous@entreprise.com"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Mot de passe</span>
              <input
                type="password"
                required
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="••••••••"
              />
            </label>

            {erreur && <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2.5">{erreur}</div>}

            <button
              type="submit"
              disabled={envoi}
              className="mt-1 bg-accent hover:bg-accent-strong text-accent-contrast text-sm font-semibold rounded-lg py-2.5 transition-colors disabled:opacity-60"
            >
              {envoi ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../types/stock'

interface Profil {
  id: string
  entreprise_id: string
  nom_complet: string
  role: Role
}

interface AuthState {
  session: Session | null
  profil: Profil | null
  /** Entrepôts assignés au profil connecté (pertinent pour Gestionnaire/Magasinier). */
  entrepotsAssignes: string[]
  chargement: boolean
  connexion: (email: string, motDePasse: string) => Promise<string | null>
  deconnexion: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [entrepotsAssignes, setEntrepotsAssignes] = useState<string[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setChargement(false)
    })

    const { data: abonnement } = supabase.auth.onAuthStateChange((_event, nouvelleSession) => {
      setSession(nouvelleSession)
      if (!nouvelleSession) {
        setProfil(null)
        setEntrepotsAssignes([])
        setChargement(false)
      }
    })

    return () => abonnement.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setChargement(true)
    Promise.all([
      supabase.from('profiles').select('id, entreprise_id, nom_complet, role').eq('id', session.user.id).single(),
      supabase.from('profils_entrepots').select('entrepot_id').eq('profile_id', session.user.id),
    ]).then(([{ data: profilData }, { data: assignationsData }]) => {
      setProfil(profilData)
      setEntrepotsAssignes((assignationsData ?? []).map((a) => a.entrepot_id))
      setChargement(false)
    })
  }, [session])

  async function connexion(email: string, motDePasse: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    return error ? error.message : null
  }

  async function deconnexion() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profil, entrepotsAssignes, chargement, connexion, deconnexion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit etre utilise a l\'interieur de AuthProvider')
  return ctx
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { effacerEtatsPersistants } from '../lib/etatPersistant'
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

  // Supabase renvoie un nouvel objet session à chaque retour sur la fenêtre
  // (revérification / renouvellement du jeton). On ne recharge le profil que
  // si l'utilisateur change vraiment : sinon l'écran "Chargement..." démontait
  // l'application et faisait perdre les onglets ouverts et la saisie en cours.
  const utilisateurId = session?.user.id ?? null

  useEffect(() => {
    if (!utilisateurId) return
    setChargement(true)
    Promise.all([
      supabase.from('profiles').select('id, entreprise_id, nom_complet, role').eq('id', utilisateurId).single(),
      supabase.from('profils_entrepots').select('entrepot_id').eq('profile_id', utilisateurId),
    ]).then(([{ data: profilData }, { data: assignationsData }]) => {
      setProfil(profilData)
      setEntrepotsAssignes((assignationsData ?? []).map((a) => a.entrepot_id))
      setChargement(false)
    })
  }, [utilisateurId])

  async function connexion(email: string, motDePasse: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    return error ? error.message : null
  }

  async function deconnexion() {
    await supabase.auth.signOut()
    // Onglets et saisies gardés pour l'actualisation : rien ne doit rester pour le compte suivant.
    effacerEtatsPersistants()
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

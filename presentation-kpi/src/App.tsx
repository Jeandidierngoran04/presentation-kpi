import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { Database, Presentation as IconePres, Settings2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useDonnees } from './lib/source'
import { Accueil } from './pages/Accueil'
import { Preparation } from './pages/Preparation'
import { PagePresentation } from './pages/Presentation'
import { PageSource } from './pages/Source'
import { PageParametres } from './pages/Parametres'

function Entete() {
  const d = useDonnees()
  const couleur = d.mode === 'demo' ? 'var(--color-vigilance)' : d.statut === 'erreur' ? 'var(--color-alerte)' : 'var(--color-bon)'
  const lien = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-white/12 text-white' : 'text-white/65 hover:text-white hover:bg-white/8'
    }`
  return (
    <header className="sticky top-0 z-30 bg-nuit">
      <div className="mx-auto max-w-[1280px] h-16 px-4 sm:px-6 flex items-center gap-6">
        <NavLink to="/" className="flex items-center gap-3 text-white">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-bleu-450">
            <IconePres size={19} strokeWidth={2.2} />
          </span>
          <span className="hidden sm:inline font-semibold tracking-tight text-[17px]">Présentation KPI</span>
        </NavLink>
        <nav className="ml-auto flex items-center gap-1">
          <NavLink to="/" end className={lien}>
            Présentations
          </NavLink>
          <NavLink to="/donnees" className={lien} title={d.mode === 'demo' ? 'Copie de la feuille Donnée (Sheet non connecté)' : d.statut === 'erreur' ? 'Connexion en échec' : 'Connecté au Google Sheet'}>
            <span className="relative">
              <Database size={16} />
              <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full ring-2 ring-nuit" style={{ background: couleur }} />
            </span>
            Données
          </NavLink>
          <NavLink to="/parametres" className={lien}>
            <Settings2 size={16} />
            <span className="hidden sm:inline">Paramètres</span>
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/p/:id" element={<PagePresentation />} />
        <Route
          path="*"
          element={
            <div className="min-h-full flex flex-col">
              <Entete />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Accueil />} />
                  <Route path="/nouvelle/:type" element={<Preparation />} />
                  <Route path="/modifier/:id" element={<Preparation />} />
                  <Route path="/parametres" element={<PageParametres />} />
                  <Route path="/cibles" element={<Navigate to="/parametres?onglet=cibles" replace />} />
                  <Route path="/donnees" element={<PageSource />} />
                  <Route path="/saisie" element={<Navigate to="/parametres?onglet=corrections" replace />} />
                </Routes>
              </main>
            </div>
          }
        />
      </Routes>
    </HashRouter>
  )
}

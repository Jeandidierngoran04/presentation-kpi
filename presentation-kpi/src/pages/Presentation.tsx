import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, FileDown, Lock, Maximize2, Pencil, Play, Presentation as IconePptx, RefreshCw, X , Plus } from 'lucide-react'
import { CadreDiapo, HAUTEUR, LARGEUR } from '../components/CadreDiapo'
import { EditeurNotes } from '../components/EditeurNotes'
import { capturer, exporterPdf, exporterPptx } from '../lib/export'
import { actualiser } from '../lib/source'
import { useLignes } from '../lib/saisie'
import { ciblesManuelles, useManuel } from '../lib/manuel'
import { useCibles, usePresentations } from '../lib/stockage'
import { creerCtx } from '../diapos/contexte'
import { construireDiapos, diaposVisibles, DIAPOS_AJOUTABLES, type DiapoDef } from '../diapos'
import { periodeTexte } from '../diapos/Ouverture'
import { dateLongue } from '../lib/format'

function Diaporama({ diapos, depart, fermer }: { diapos: DiapoDef[]; depart: number; fermer: () => void }) {
  const [i, setI] = useState(Math.min(depart, diapos.length - 1))
  const [inactif, setInactif] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const minuteur = useRef<number | undefined>(undefined)

  const aller = useCallback((n: number) => setI((x) => Math.max(0, Math.min(diapos.length - 1, x + n))), [diapos.length])

  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {})
    const touche = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault()
        aller(1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault()
        aller(-1)
      } else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(diapos.length - 1)
      else if (e.key === 'Escape') fermer()
    }
    let entre = false
    const sortiePleinEcran = () => {
      if (document.fullscreenElement) entre = true
      else if (entre) fermer()
    }
    window.addEventListener('keydown', touche)
    document.addEventListener('fullscreenchange', sortiePleinEcran)
    return () => {
      window.removeEventListener('keydown', touche)
      document.removeEventListener('fullscreenchange', sortiePleinEcran)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [aller, fermer, diapos.length])

  const bouger = () => {
    setInactif(false)
    window.clearTimeout(minuteur.current)
    minuteur.current = window.setTimeout(() => setInactif(true), 2200)
  }
  useEffect(() => {
    bouger()
    return () => window.clearTimeout(minuteur.current)
  }, [])

  return (
    <div ref={ref} onMouseMove={bouger} className={`fixed inset-0 z-50 bg-[#05080d] select-none ${inactif ? 'curseur-cache' : ''}`}>
      <div className="absolute inset-0" onClick={(e) => aller(e.clientX < window.innerWidth / 3 ? -1 : 1)}>
        <CadreDiapo ajuster="contenir">
          <div key={i} className="diapo-entree w-full h-full">
            {diapos[i].rendu}
          </div>
        </CadreDiapo>
      </div>

      {/* barre de progression */}
      <div className="absolute left-0 right-0 bottom-0 h-1 bg-white/10">
        <div className="h-full bg-bleu-450 transition-[width] duration-300" style={{ width: `${((i + 1) / diapos.length) * 100}%` }} />
      </div>

      <div className={`absolute left-1/2 -translate-x-1/2 bottom-5 flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2 py-1.5 text-white transition-opacity ${inactif ? 'opacity-0' : 'opacity-100'}`}>
        <button onClick={() => aller(-1)} className="p-2 rounded-full hover:bg-white/15" aria-label="Diapo précédente">
          <ChevronLeft size={20} />
        </button>
        <span className="chiffres text-sm px-2 min-w-[64px] text-center">
          {i + 1} / {diapos.length}
        </span>
        <button onClick={() => aller(1)} className="p-2 rounded-full hover:bg-white/15" aria-label="Diapo suivante">
          <ChevronRight size={20} />
        </button>
        <span className="w-px h-5 bg-white/20 mx-1" />
        <button onClick={fermer} className="p-2 rounded-full hover:bg-white/15" aria-label="Quitter le diaporama">
          <X size={20} />
        </button>
      </div>
    </div>
  )
}

export function PagePresentation() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const { liste, enregistrer } = usePresentations()
  const [ciblesSheet] = useCibles()
  const pres = liste.find((p) => p.id === id)
  const { lignes: lignesSheet, donnees, saisie } = useLignes()
  const manuel = useManuel()
  const [exportEnCours, setExport] = useState<{ format: 'pptx' | 'pdf'; fait: number } | null>(null)
  const refsExport = useRef<(HTMLDivElement | null)[]>([])

  const estManuel = pres?.source === 'manuel'
  const lignesActuelles = estManuel ? manuel.valeurs : lignesSheet
  const lignes = pres?.photo?.lignes ?? lignesActuelles
  const ciblesActuelles = useMemo(() => ({ ...ciblesSheet, ...ciblesManuelles(manuel) }), [ciblesSheet, manuel])
  const cibles = pres?.photo?.cibles ?? ciblesActuelles
  const toutes = useMemo(() => (pres ? construireDiapos(creerCtx(pres, lignes, cibles, estManuel || pres.photo ? [] : saisie.valeurs)) : []), [pres, lignes, cibles, estManuel, saisie.valeurs])
  // Diapos vides retirées ; les diapos facultatives ajoutées à la main restent
  const diapos = useMemo(() => (pres ? diaposVisibles(toutes, pres) : []), [toutes, pres])
  const ajoutables = pres ? DIAPOS_AJOUTABLES.filter((a) => !diapos.some((d) => d.id === a.id)) : []
  const ajoutees = pres?.diaposAjoutees ?? []

  const diapoParam = params.get('diapo')
  const fermer = useCallback(() => setParams({}, { replace: true }), [setParams])

  if (!pres)
    return (
      <div className="p-10 text-center">
        <p className="text-ink-2">Présentation introuvable.</p>
        <Link to="/" className="mt-4 inline-block text-bleu-450 font-medium">
          Retour à l'accueil
        </Link>
      </div>
    )

  const exporter = async (format: 'pptx' | 'pdf') => {
    setExport({ format, fait: 0 })
    try {
      await new Promise((r) => setTimeout(r, 400)) // laisse le temps aux diapos hors écran de se dessiner
      const noeuds = refsExport.current.filter(Boolean) as HTMLDivElement[]
      const images = await capturer(noeuds, format === 'pptx' ? 'png' : 'jpeg', (n) => setExport({ format, fait: n }))
      if (format === 'pptx') await exporterPptx(images, pres.titre, diapos.map((d) => d.titre))
      else await exporterPdf(images, pres.titre)
    } catch (e) {
      alert("L'export n'a pas abouti : " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setExport(null)
    }
  }

  const cloturer = () => {
    if (!confirm('Clôturer fige les chiffres de cette présentation. Ils ne changeront plus, même si le Google Sheet est modifié. Continuer ?')) return
    // Le mode automatique est figé sur les périodes affichées au moment de la clôture
    const periodes = creerCtx(pres, lignesActuelles, ciblesActuelles).periodes
    enregistrer({ ...pres, periodes, glissant: undefined, clotureeLe: new Date().toISOString(), photo: { lignes: lignesActuelles, cibles: ciblesActuelles } })
  }

  return (
    <div className="min-h-full bg-page">
      <header className="sticky top-0 z-30 bg-nuit text-white">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <button onClick={() => nav('/')} className="p-2 -ml-2 rounded-full hover:bg-white/10" aria-label="Retour">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{pres.titre}</div>
            <div className="text-sm text-white/60 truncate">{periodeTexte(creerCtx(pres, lignes, cibles))}</div>
          </div>
          {pres.clotureeLe ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm">
              <Lock size={14} /> Clôturée le {dateLongue(pres.clotureeLe.slice(0, 10))}
            </span>
          ) : (
            <>
              <button onClick={() => actualiser()} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white/75 hover:bg-white/10" title="Relire le Google Sheet">
                <RefreshCw size={15} className={donnees.statut === 'chargement' ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">
                  {donnees.mode === 'demo'
                    ? 'Copie de « Donnée »'
                    : donnees.statut === 'erreur'
                      ? 'Sheet injoignable'
                      : donnees.luLe
                        ? `À jour à ${new Date(donnees.luLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Lecture…'}
                </span>
              </button>
              <Link to={`/modifier/${pres.id}`} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-white/10">
                <Pencil size={15} /> Modifier
              </Link>
              <button onClick={cloturer} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-white/10">
                <Lock size={15} /> Clôturer
              </button>
            </>
          )}
          <button onClick={() => exporter('pptx')} disabled={!!exportEnCours} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50" title="Télécharger en PowerPoint">
            <IconePptx size={15} /> PowerPoint
          </button>
          <button onClick={() => exporter('pdf')} disabled={!!exportEnCours} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50" title="Télécharger en PDF">
            <FileDown size={15} /> PDF
          </button>
          <button onClick={() => setParams({ diapo: '0' })} className="inline-flex items-center gap-2 rounded-full bg-bleu-450 hover:bg-bleu-550 px-5 py-2.5 font-semibold">
            <Play size={16} fill="currentColor" /> Diaporama
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-8 grid gap-8">
        {diapos.map((d, i) => (
          <section key={d.id} className="group">
            <div className="mb-2 flex items-center justify-between text-sm text-ink-2">
              <span>
                <span className="chiffres text-muted mr-2">{String(i + 1).padStart(2, '0')}</span>
                {d.titre}
              </span>
              <span className="flex items-center gap-1">
                {!pres.clotureeLe && ajoutees.includes(d.id) && (
                  <button
                    onClick={() => enregistrer({ ...pres, diaposAjoutees: ajoutees.filter((x) => x !== d.id) })}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 opacity-0 group-hover:opacity-100 hover:bg-carte transition"
                  >
                    <X size={14} /> Retirer la diapo
                  </button>
                )}
                <button onClick={() => setParams({ diapo: String(i) })} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 opacity-0 group-hover:opacity-100 hover:bg-carte transition">
                  <Maximize2 size={14} /> Projeter depuis ici
                </button>
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.05),0_12px_32px_-16px_rgba(0,0,0,.18)] ring-1 ring-ligne">
              <CadreDiapo>{d.rendu}</CadreDiapo>
            </div>
            {!pres.clotureeLe && (d.id === 'divers' || d.id === 'problemes' || d.id === 'commentaires') && (
              <div className="mt-3">
                <EditeurNotes notes={pres.notes} pays={pres.pays} partie={d.id} onChange={(notes) => enregistrer({ ...pres, notes })} />
              </div>
            )}
          </section>
        ))}
        {!pres.clotureeLe && ajoutables.length > 0 && (
          <div className="rounded-2xl border-2 border-dashed border-grille p-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 font-semibold text-ink">
              <Plus size={18} /> Ajouter une diapo
            </span>
            {ajoutables.map((a) => (
              <button
                key={a.id}
                onClick={() => enregistrer({ ...pres, diaposAjoutees: [...ajoutees, a.id] })}
                className="rounded-full border border-ligne bg-carte px-4 py-2 text-sm font-medium hover:border-bleu-450 hover:text-bleu-550"
              >
                {a.titre}
              </button>
            ))}
          </div>
        )}
      </main>

      {exportEnCours && (
        <>
          <div aria-hidden className="anim-figee" style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
            {diapos.map((d, i) => (
              <div
                key={d.id}
                ref={(el) => {
                  refsExport.current[i] = el
                }}
                style={{ width: LARGEUR, height: HAUTEUR, overflow: 'hidden' }}
              >
                {d.rendu}
              </div>
            ))}
          </div>
          <div className="fixed inset-0 z-40 grid place-items-center bg-nuit/40 backdrop-blur-sm">
            <div className="rounded-3xl bg-carte px-10 py-8 text-center shadow-xl min-w-[320px]">
              <div className="font-semibold text-lg">Préparation du {exportEnCours.format === 'pptx' ? 'PowerPoint' : 'PDF'}…</div>
              <div className="mt-4 h-2 rounded-full bg-ligne overflow-hidden">
                <div className="h-full bg-bleu-450 transition-[width]" style={{ width: `${(exportEnCours.fait / diapos.length) * 100}%` }} />
              </div>
              <div className="mt-2 text-sm text-ink-2 chiffres">
                {exportEnCours.fait} / {diapos.length} diapos
              </div>
            </div>
          </div>
        </>
      )}

      {diapoParam != null && diapos.length > 0 && <Diaporama diapos={diapos} depart={Number(diapoParam) || 0} fermer={fermer} />}
    </div>
  )
}

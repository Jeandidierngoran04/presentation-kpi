import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { FileDown, FileSpreadsheet, FileText, Search, X } from 'lucide-react'
import { messageErreur } from '../../lib/erreurs'
import { dateVersInput } from '../../lib/dates'
import {
  getDocumentsHistorique,
  getLignesDocument,
  type DocumentHistorique,
} from '../../lib/api/historique'
import { exporterCsv, exporterExcel, nomFichierSur, type ValeurExport } from '../../lib/export/fichiers'
import { Modal } from '../ui/Modal'
import { useMenuContextuel, type ElementMenuContextuel } from '../ui/MenuContextuel'
import { CLASSE_CHAMP_COMPACT, CLASSE_LABEL } from '../ui/styles'
import { EnTetePage } from '../ui/EnTetePage'
import { ChampRecherche } from '../ui/ChampRecherche'
import { texteFiltre } from '../../lib/filtreTexte'

export interface ColonneDocument<R> {
  titre: string
  /** Valeur brute : sert à l'export et à l'affichage par défaut. */
  valeur: (ligne: R) => ValeurExport
  /** Affichage personnalisé dans le tableau (badge, couleur...). */
  rendu?: (ligne: R) => ReactNode
  droite?: boolean
  mono?: boolean
  largeurExcel?: number
}

export interface ConfigDocuments<D extends DocumentHistorique, L> {
  /** Vue v_historique_* listant les documents. */
  vue: string
  /** Nom du type de document, au pluriel (titre des fichiers exportés). */
  libelle: string
  /** Colonne filtrable par clic droit (numéro du document). */
  colonneNumero?: { cle: string; titre: string }
  colonnes: ColonneDocument<D>[]
  /** Lignes du document (détail), absentes pour une liste sans détail. */
  lignes?: {
    vue: string
    colonneLien: string
    colonnes: ColonneDocument<L>[]
    tri?: (a: L, b: L) => number
  }
  titreDetail?: (document: D) => string
  /** Export PDF du document (ex. bon de sortie). */
  exportPdf?: (document: D, lignes: L[]) => Promise<void>
}

interface ListeDocumentsProps<D extends DocumentHistorique, L> {
  config: ConfigDocuments<D, L>
  /** Titre de l'écran (par défaut, le libellé de la configuration). */
  titre?: string
  /** L'onglet est-il affiché ? Les données sont rechargées à chaque retour. */
  estActif: boolean
  /** Liste du jour (sans sélection de dates). */
  duJourSeulement?: boolean
  /** Boutons ajoutés à droite de la barre d'outils. */
  actions?: ReactNode
  idEnSurbrillance?: string | null
  /** Incrémenté par le parent pour forcer un rechargement. */
  jetonRechargement?: number
  /** Éléments du clic droit dans le tableau (ex. "Nouvelle sortie"). */
  elementsMenuTableau?: ElementMenuContextuel[]
}

const JOURS_PAR_DEFAUT = 30

function afficher<R>(colonne: ColonneDocument<R>, ligne: R): ReactNode {
  if (colonne.rendu) return colonne.rendu(ligne)
  const valeur = colonne.valeur(ligne)
  if (valeur == null || valeur === '') return <span className="text-text-muted">—</span>
  if (typeof valeur === 'number') return valeur.toLocaleString('fr-FR')
  if (valeur instanceof Date) return valeur.toLocaleString('fr-FR')
  return valeur
}

/** Largeur de chaque colonne, en proportion de sa largeur d'export : le tableau tient dans l'écran, sans défilement horizontal. */
function Largeurs<R>({ colonnes }: { colonnes: ColonneDocument<R>[] }) {
  const total = colonnes.reduce((somme, c) => somme + (c.largeurExcel ?? 14), 0)
  return (
    <colgroup>
      {colonnes.map((c) => (
        <col key={c.titre} style={{ width: `${(((c.largeurExcel ?? 14) / total) * 100).toFixed(2)}%` }} />
      ))}
    </colgroup>
  )
}

function TableauLignes<R extends { id?: unknown }>({ colonnes, lignes }: { colonnes: ColonneDocument<R>[]; lignes: R[] }) {
  return (
    <table className="tableau-dense tableau-ajuste">
      <Largeurs colonnes={colonnes} />
      <thead className="sticky top-0 z-10">
        <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
          {colonnes.map((c) => (
            <th key={c.titre} className={`font-semibold h-8 px-3 ${c.droite ? 'text-right' : ''}`}>
              {c.titre}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={String(l.id ?? i)} className="h-9 border-t border-border">
            {colonnes.map((c) => (
              <td
                key={c.titre}
                className={`px-3 ${c.droite ? 'text-right' : ''} ${c.mono ? 'font-mono text-text-muted' : 'text-text'}`}
              >
                {afficher(c, l)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BoutonExport({ icone: Icone, label, onClick }: { icone: typeof FileText; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-text text-xs font-semibold rounded-lg px-3 h-8 transition-colors"
    >
      <Icone size={14} strokeWidth={1.75} /> {label}
    </button>
  )
}

/**
 * Liste de documents (sorties, entrées, transferts...) : filtre par dates,
 * filtre par numéro au clic droit, détail du document sélectionné en bas,
 * double-clic pour la fiche complète, exports PDF / Excel / CSV.
 */
export function ListeDocuments<D extends DocumentHistorique, L extends { id?: unknown }>({
  config,
  titre,
  estActif,
  duJourSeulement = false,
  actions,
  idEnSurbrillance,
  jetonRechargement = 0,
  elementsMenuTableau,
}: ListeDocumentsProps<D, L>) {
  const aujourdhui = dateVersInput(new Date())
  const [du, setDu] = useState(() =>
    duJourSeulement ? aujourdhui : dateVersInput(new Date(Date.now() - JOURS_PAR_DEFAUT * 86_400_000)),
  )
  const [au, setAu] = useState(aujourdhui)
  const [numero, setNumero] = useState('')
  const [documents, setDocuments] = useState<D[]>([])
  const [recherche, setRecherche] = useState('')
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [lignesSelection, setLignesSelection] = useState<L[]>([])
  const [detail, setDetail] = useState<D | null>(null)
  const [saisieNumero, setSaisieNumero] = useState<{ x: number; y: number; valeur: string } | null>(null)
  const saisieRef = useRef<HTMLInputElement>(null)
  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()

  // La liste du jour suit la date du jour (onglet resté ouvert après minuit).
  const borneDu = duJourSeulement ? aujourdhui : du
  const borneAu = duJourSeulement ? aujourdhui : au

  useEffect(() => {
    if (!estActif) return
    let annule = false
    getDocumentsHistorique<D>(config.vue, {
      du: borneDu || null,
      au: borneAu || null,
      colonneNumero: config.colonneNumero?.cle,
      numero,
    })
      .then((d) => {
        if (annule) return
        setDocuments(d)
        setErreur(null)
      })
      .catch((e) => {
        if (!annule) setErreur(messageErreur(e))
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [estActif, borneDu, borneAu, numero, jetonRechargement, config.vue, config.colonneNumero?.cle])

  // Le document mis en avant (ex. la sortie qui vient d'être validée) est sélectionné.
  useEffect(() => {
    if (idEnSurbrillance) setSelectionId(idEnSurbrillance)
  }, [idEnSurbrillance])

  useEffect(() => {
    if (!selectionId || !config.lignes) return
    const { vue, colonneLien, tri } = config.lignes
    let annule = false
    getLignesDocument<L>(vue, colonneLien, selectionId)
      .then((l) => {
        if (!annule) setLignesSelection(tri ? [...l].sort(tri) : l)
      })
      .catch((e) => {
        if (!annule) setErreur(messageErreur(e))
      })
    return () => {
      annule = true
    }
  }, [selectionId, config.lignes, jetonRechargement])

  useEffect(() => {
    if (saisieNumero) setTimeout(() => saisieRef.current?.focus(), 0)
  }, [saisieNumero])

  // Recherche dans toutes les colonnes affichées de la liste.
  const documentsAffiches = useMemo(() => {
    if (!recherche.trim()) return documents
    return documents.filter((d) =>
      config.colonnes.some((c) => {
        const v = c.valeur(d)
        return v != null && texteFiltre(v instanceof Date ? v.toLocaleDateString('fr-FR') : String(v), recherche)
      }),
    )
  }, [documents, recherche, config.colonnes])
  const selection = documents.find((d) => d.id === selectionId) ?? null
  const lignesDetail = detail && detail.id === selectionId ? lignesSelection : []

  function ouvrirSaisieNumero(e: MouseEvent) {
    if (!config.colonneNumero) return
    e.preventDefault()
    e.stopPropagation()
    setSaisieNumero({ x: e.clientX, y: e.clientY, valeur: numero })
  }

  function appliquerNumero(valeur: string) {
    setNumero(valeur.trim())
    setSaisieNumero(null)
  }

  function exporterListe(format: 'excel' | 'csv') {
    const colonnes = config.colonnes.map((c) => ({ titre: c.titre, largeur: c.largeurExcel }))
    const lignes = documentsAffiches.map((d) => config.colonnes.map((c) => c.valeur(d)))
    const nom = nomFichierSur(
      numero ? `${config.libelle}_${numero}` : duJourSeulement ? `${config.libelle}_${borneDu}` : `${config.libelle}_${borneDu}_au_${borneAu}`,
    )
    if (format === 'csv') exporterCsv(nom, colonnes, lignes)
    else exporterExcel(nom, colonnes, lignes, config.libelle).catch((e) => setErreur(messageErreur(e)))
  }

  function exporterDetail(format: 'pdf' | 'excel' | 'csv') {
    if (!detail || !config.lignes) return
    const titre = config.titreDetail?.(detail) ?? config.libelle
    if (format === 'pdf') {
      config.exportPdf?.(detail, lignesDetail).catch((e) => setErreur(messageErreur(e)))
      return
    }
    const colonnes = config.lignes.colonnes.map((c) => ({ titre: c.titre, largeur: c.largeurExcel }))
    const lignes = lignesDetail.map((l) => config.lignes!.colonnes.map((c) => c.valeur(l)))
    const nom = nomFichierSur(titre)
    if (format === 'csv') exporterCsv(nom, colonnes, lignes)
    else exporterExcel(nom, colonnes, lignes, titre).catch((e) => setErreur(messageErreur(e)))
  }

  const numeroEstColonne = (c: ColonneDocument<D>) => config.colonneNumero && c.titre === config.colonneNumero.titre

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 min-h-0">
      {/* En-tête compact : titre [nombre] à gauche, exports et actions à droite */}
      <EnTetePage
        titre={titre ?? config.libelle}
        compteur={documentsAffiches.length}
        actions={
          <>
            <ChampRecherche valeur={recherche} onChange={setRecherche} aide="Dans toutes les colonnes de la liste (* en tête = contient)" />
            <BoutonExport icone={FileSpreadsheet} label="Excel" onClick={() => exporterListe('excel')} />
            <BoutonExport icone={FileDown} label="CSV" onClick={() => exporterListe('csv')} />
            {actions}
          </>
        }
      />

      {/* Ligne de filtres */}
      <div className="shrink-0 flex items-center gap-2 flex-wrap">
        {duJourSeulement ? (
          <span className="h-[26px] flex items-center rounded-md border border-border bg-muted px-2.5 text-xs text-text-muted">
            Aujourd'hui, {new Date().toLocaleDateString('fr-FR')}
          </span>
        ) : (
          <>
            <label className="flex items-center gap-1.5 text-xs text-text-muted">
              Du
              <input type="date" value={du} max={au || undefined} onChange={(e) => setDu(e.target.value)} className={`${CLASSE_CHAMP_COMPACT} w-[140px]`} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text-muted">
              au
              <input type="date" value={au} min={du || undefined} onChange={(e) => setAu(e.target.value)} className={`${CLASSE_CHAMP_COMPACT} w-[140px]`} />
            </label>
          </>
        )}
        {config.colonneNumero && !numero && (
          <button
            type="button"
            onClick={(e) => setSaisieNumero({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().bottom + 4, valeur: '' })}
            className="h-[26px] inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs text-text-muted hover:text-text"
          >
            <Search size={12} strokeWidth={1.75} /> {config.colonneNumero.titre}
          </button>
        )}
        {numero && (
          <span className="inline-flex items-center gap-1.5 h-[26px] rounded-full border border-accent bg-accent-soft px-2.5 text-xs font-semibold text-accent-deep">
            {config.colonneNumero?.titre} : {numero} <span className="font-normal">(toutes dates)</span>
            <button onClick={() => setNumero('')} title="Retirer le filtre" className="hover:text-danger">
              <X size={13} strokeWidth={1.75} />
            </button>
          </span>
        )}
      </div>

      {erreur && <div className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}

      {/* Liste */}
      <div
        className="flex-1 min-h-[160px] bg-card rounded-lg border border-border overflow-auto"
        onContextMenu={(e) => {
          if (elementsMenuTableau && elementsMenuTableau.length > 0) ouvrirMenu(e, elementsMenuTableau)
        }}
      >
        <table className="tableau-dense tableau-ajuste">
          <Largeurs colonnes={config.colonnes} />
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
              {config.colonnes.map((c) => (
                <th
                  key={c.titre}
                  onContextMenu={numeroEstColonne(c) ? ouvrirSaisieNumero : undefined}
                  title={numeroEstColonne(c) ? 'Clic droit pour rechercher un numéro' : undefined}
                  className={`font-semibold h-8 px-3 whitespace-nowrap ${c.droite ? 'text-right' : ''} ${
                    numeroEstColonne(c) ? 'cursor-context-menu' : ''
                  }`}
                >
                  {c.titre}
                  {numeroEstColonne(c) && <Search size={11} strokeWidth={1.75} className="inline ml-1 -mt-0.5" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documentsAffiches.map((d) => (
              <tr
                key={d.id}
                onClick={() => setSelectionId(d.id)}
                onDoubleClick={() => {
                  if (!config.lignes) return
                  setSelectionId(d.id)
                  setDetail(d)
                }}
                className={`h-9 border-t border-border cursor-pointer ${
                  selectionId === d.id ? 'bg-accent-soft' : 'hover:bg-black/5 dark:hover:bg-white/5'
                } ${idEnSurbrillance === d.id ? 'font-semibold' : ''}`}
              >
                {config.colonnes.map((c) => (
                  <td
                    key={c.titre}
                    onContextMenu={numeroEstColonne(c) ? ouvrirSaisieNumero : undefined}
                    title={typeof c.valeur(d) === 'string' ? (c.valeur(d) as string) : undefined}
                    className={`px-3 whitespace-nowrap ${c.droite ? 'text-right' : ''} ${
                      numeroEstColonne(c)
                        ? 'font-mono text-xs text-info-deep underline underline-offset-2'
                        : c.mono
                          ? 'font-mono text-xs text-text-muted'
                          : 'text-text'
                    }`}
                  >
                    {afficher(c, d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!chargement && documents.length === 0 && (
          <p className="text-sm text-text-muted py-10 text-center">
            {numero ? `Aucun document ne correspond à "${numero}".` : 'Aucun document sur cette période.'}
          </p>
        )}
        {!chargement && documents.length > 0 && documentsAffiches.length === 0 && (
          <p className="text-sm text-text-muted py-10 text-center">Aucun document ne correspond à la recherche.</p>
        )}
        {chargement && <p className="text-sm text-text-muted py-10 text-center">Chargement...</p>}
      </div>

      {/* Détail du document sélectionné */}
      {config.lignes && selection && (
        <div className="shrink-0 max-h-[32vh] flex flex-col bg-card rounded-lg border border-border overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-text uppercase tracking-wide">
              {config.titreDetail?.(selection) ?? 'Détail'}
            </span>
            <span className="text-xs text-text-muted">Double-clic sur la ligne pour la fiche complète et les exports</span>
          </div>
          <div className="overflow-auto">
            <TableauLignes colonnes={config.lignes.colonnes} lignes={lignesSelection} />
          </div>
        </div>
      )}

      {/* Fiche complète + exports */}
      {detail && config.lignes && (
        <Modal titre={config.titreDetail?.(detail) ?? 'Détail'} onFermer={() => setDetail(null)} large sansConfirmationFermeture>
          <div className="flex flex-col gap-3 min-h-0">
            <dl className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 bg-muted/50 border border-border rounded-lg p-3">
              {config.colonnes.map((c) => (
                <div key={c.titre} className="flex flex-col gap-0.5 min-w-0">
                  <dt className={CLASSE_LABEL}>{c.titre}</dt>
                  <dd className="text-[13px] text-text truncate">{afficher(c, detail)}</dd>
                </div>
              ))}
            </dl>
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
              <TableauLignes colonnes={config.lignes.colonnes} lignes={lignesDetail} />
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2">
              <span className="text-xs text-text-muted mr-1">Exporter :</span>
              {config.exportPdf && <BoutonExport icone={FileText} label="PDF" onClick={() => exporterDetail('pdf')} />}
              <BoutonExport icone={FileSpreadsheet} label="Excel" onClick={() => exporterDetail('excel')} />
              <BoutonExport icone={FileDown} label="CSV" onClick={() => exporterDetail('csv')} />
            </div>
          </div>
        </Modal>
      )}

      {/* Recherche d'un numéro (clic droit sur la colonne) */}
      {saisieNumero && (
        <div className="fixed inset-0 z-50" onClick={() => setSaisieNumero(null)}>
          <div
            className="fixed bg-card border border-border rounded-lg shadow-lg p-3 flex flex-col gap-2 w-[260px]"
            style={{ top: saisieNumero.y, left: Math.min(saisieNumero.x, window.innerWidth - 280) }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={CLASSE_LABEL}>Rechercher un {config.colonneNumero?.titre.toLowerCase()}</span>
            <input
              ref={saisieRef}
              value={saisieNumero.valeur}
              onChange={(e) => setSaisieNumero((s) => (s ? { ...s, valeur: e.target.value } : s))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') appliquerNumero(saisieNumero.valeur)
                if (e.key === 'Escape') setSaisieNumero(null)
              }}
              placeholder="Ex. BS-2026-00012 ou 00012"
              className={`${CLASSE_CHAMP_COMPACT} font-mono`}
            />
            <div className="flex justify-end gap-2">
              {numero && (
                <button type="button" onClick={() => appliquerNumero('')} className="text-xs font-semibold text-text-muted hover:text-text px-2">
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={() => appliquerNumero(saisieNumero.valeur)}
                className="text-xs font-semibold bg-accent hover:bg-accent-strong text-accent-contrast rounded-lg px-3 py-1.5"
              >
                Rechercher
              </button>
            </div>
          </div>
        </div>
      )}

      {menu}
    </div>
  )
}

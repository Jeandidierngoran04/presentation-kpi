import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Filter, Upload } from 'lucide-react'
import { CaseFiltre, PanneauFiltres, SectionFiltre } from '../ui/PanneauFiltres'
import { exporterListePdf } from '../../lib/export/listePdf'
import { FileDown, FileSpreadsheet, FileText, X } from 'lucide-react'
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
import { BandeauErreur } from '../ui/BandeauErreur'

export interface ColonneDocument<R> {
  titre: string
  /** Valeur brute : sert à l'export et à l'affichage par défaut. */
  valeur: (ligne: R) => ValeurExport
  /** Affichage personnalisé dans le tableau (badge, couleur...). */
  rendu?: (ligne: R) => ReactNode
  droite?: boolean
  mono?: boolean
  largeurExcel?: number
  /** Colonne absente du tableau à l'écran, mais gardée dans les exports (Excel, CSV, PDF). */
  masqueEcran?: boolean
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
  /** Types proposés dans le filtre avancé (champ `type` des documents), ex. types de mouvement. */
  typesFiltre?: { id: string; label: string }[]
}

// --- Filtre avancé ------------------------------------------------------------

type Periode = 'jour' | '7' | '30' | '90' | 'annee' | 'tout' | 'perso'

const PERIODES: { id: Exclude<Periode, 'perso'>; label: string }[] = [
  { id: 'jour', label: "Aujourd'hui" },
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: '90', label: '3 mois' },
  { id: 'annee', label: 'Cette année' },
  { id: 'tout', label: 'Tout' },
]

interface FiltreAvance {
  periode: Periode
  du: string
  au: string
  /** Rien de coché = tous. */
  depots: string[]
  types: string[]
  /** Code ou nom du produit (* en tête = contient). */
  produit: string
}

function datesPeriode(p: Exclude<Periode, 'perso'>): { du: string; au: string } {
  const aujourdhui = new Date()
  if (p === 'tout') return { du: '', au: '' }
  const debut = new Date(aujourdhui)
  if (p === 'annee') debut.setMonth(0, 1)
  else if (p !== 'jour') debut.setDate(debut.getDate() - Number(p) + 1)
  return { du: dateVersInput(debut), au: dateVersInput(aujourdhui) }
}

const dateFr = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR')

function libellePeriode(f: FiltreAvance): string {
  const raccourci = PERIODES.find((p) => p.id === f.periode)
  if (raccourci) return raccourci.label
  if (f.du && f.au) return f.du === f.au ? `le ${dateFr(f.du)}` : `du ${dateFr(f.du)} au ${dateFr(f.au)}`
  if (f.du) return `depuis le ${dateFr(f.du)}`
  if (f.au) return `jusqu'au ${dateFr(f.au)}`
  return 'Tout'
}

/** Dépôts d'un document (un transfert en a deux : départ et arrivée). */
function depotsDe(d: DocumentHistorique): string[] {
  return [d.entrepot_nom, d.entrepot_source_nom, d.entrepot_destination_nom].filter((v): v is string => typeof v === 'string' && v !== '')
}

function basculer<T>(liste: T[], valeur: T, coche: boolean): T[] {
  return coche ? (liste.includes(valeur) ? liste : [...liste, valeur]) : liste.filter((v) => v !== valeur)
}

interface ListeDocumentsProps<D extends DocumentHistorique, L> {
  config: ConfigDocuments<D, L>
  /** Titre de l'écran (par défaut, le libellé de la configuration). */
  titre?: string
  /** L'onglet est-il affiché ? Les données sont rechargées à chaque retour. */
  estActif: boolean
  /**
   * Liste simple des N derniers jours (écran de travail, ex. Sorties) : pas de
   * filtre avancé ni d'export, qui restent dans l'Historique.
   */
  derniersJours?: number
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

function BoutonExport({ icone: Icone, label, onClick }: { icone: typeof FileText; label: string; onClick: (e: MouseEvent) => void }) {
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
 * clic sur la ligne pour la fiche complète, exports PDF / Excel / CSV.
 */
export function ListeDocuments<D extends DocumentHistorique, L extends { id?: unknown }>({
  config,
  titre,
  estActif,
  derniersJours,
  actions,
  idEnSurbrillance,
  jetonRechargement = 0,
  elementsMenuTableau,
}: ListeDocumentsProps<D, L>) {
  const aujourdhui = dateVersInput(new Date())
  const [filtre, setFiltre] = useState<FiltreAvance>(() => ({
    periode: '30',
    du: dateVersInput(new Date(Date.now() - (JOURS_PAR_DEFAUT - 1) * 86_400_000)),
    au: aujourdhui,
    depots: [],
    types: [],
    produit: '',
  }))
  // Filtre en cours de modification dans le panneau (null = panneau fermé).
  const [brouillon, setBrouillon] = useState<FiltreAvance | null>(null)
  const { du, au } = filtre
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

  // Liste des N derniers jours : la période glisse avec la date du jour (onglet resté ouvert après minuit).
  const borneDu = derniersJours ? dateVersInput(new Date(Date.now() - (derniersJours - 1) * 86_400_000)) : du
  const borneAu = derniersJours ? aujourdhui : au

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

  // Ce que le filtre avancé peut proposer pour cette liste.
  const depotsDisponibles = useMemo(() => [...new Set(documents.flatMap(depotsDe))].sort((a, b) => a.localeCompare(b)), [documents])
  const avecProduit = documents.some((d) => d.produit_reference != null)

  // Filtre avancé (dépôts, types, produit) puis recherche dans toutes les colonnes affichées.
  const documentsAffiches = useMemo(() => {
    return documents.filter((d) => {
      if (filtre.depots.length > 0 && !depotsDe(d).some((n) => filtre.depots.includes(n))) return false
      if (filtre.types.length > 0 && !filtre.types.includes(String(d.type))) return false
      if (
        filtre.produit.trim() &&
        !texteFiltre(String(d.produit_reference ?? ''), filtre.produit) &&
        !texteFiltre(String(d.produit_designation ?? ''), filtre.produit)
      ) {
        return false
      }
      if (!recherche.trim()) return true
      return config.colonnes.some((c) => {
        const v = c.valeur(d)
        return v != null && texteFiltre(v instanceof Date ? v.toLocaleDateString('fr-FR') : String(v), recherche)
      })
    })
  }, [documents, recherche, config.colonnes, filtre])

  // Rappel des filtres actifs à côté du bouton.
  const partiesFiltre = [
    libellePeriode(filtre),
    filtre.depots.length > 0 ? filtre.depots.join(', ') : null,
    filtre.types.length > 0
      ? filtre.types.map((t) => config.typesFiltre?.find((o) => o.id === t)?.label ?? t).join(', ')
      : null,
    filtre.produit.trim() ? `produit « ${filtre.produit.trim()} »` : null,
  ].filter((x): x is string => x != null)
  const nbFiltresActifs = partiesFiltre.length - 1 + (filtre.periode === '30' ? 0 : 1)
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

  function exporterListe(format: 'excel' | 'csv' | 'pdf') {
    const colonnes = config.colonnes.map((c) => ({ titre: c.titre, largeur: c.largeurExcel }))
    const lignes = documentsAffiches.map((d) => config.colonnes.map((c) => c.valeur(d)))
    const nom = nomFichierSur(
      numero
        ? `${config.libelle}_${numero}`
        : `${config.libelle}_${borneDu || 'debut'}_au_${borneAu || 'aujourdhui'}`,
    )
    if (format === 'csv') exporterCsv(nom, colonnes, lignes)
    else if (format === 'excel') exporterExcel(nom, colonnes, lignes, config.libelle).catch((e) => setErreur(messageErreur(e)))
    else
      exporterListePdf({
        nomFichier: nom,
        titre: titre ?? config.libelle,
        sousTitre: numero ? `${config.colonneNumero?.titre ?? 'Numéro'} : ${numero}` : partiesFiltre.join(' · '),
        colonnes,
        lignes,
        colonnesADroite: config.colonnes.flatMap((c, i) => (c.droite ? [i] : [])),
      }).catch((e) => setErreur(messageErreur(e)))
  }

  function ouvrirExport(e: MouseEvent) {
    ouvrirMenu(
      e,
      [
        { label: 'Excel (.xlsx)', icone: FileSpreadsheet, onClick: () => exporterListe('excel') },
        { label: 'CSV (.csv)', icone: FileDown, onClick: () => exporterListe('csv') },
        { label: 'PDF (.pdf)', icone: FileText, onClick: () => exporterListe('pdf') },
      ],
      { sousBouton: true },
    )
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
  const colonnesEcran = config.colonnes.filter((c) => !c.masqueEcran)

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 min-h-0">
      {/* En-tête compact : titre [nombre] à gauche, exports et actions à droite */}
      <EnTetePage
        titre={titre ?? config.libelle}
        compteur={documentsAffiches.length}
        actions={
          <>
            <ChampRecherche valeur={recherche} onChange={setRecherche} aide="Dans toutes les colonnes de la liste (* en tête = contient)" />
            {!derniersJours && (
              <button
                type="button"
                onClick={() => setBrouillon(filtre)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  nbFiltresActifs > 0 ? 'bg-accent-soft border-accent/50 text-accent-deep' : 'bg-card border-border text-text hover:bg-muted'
                }`}
                title={`Filtres appliqués : ${partiesFiltre.join(' · ')}`}
              >
                <Filter size={14} strokeWidth={1.75} /> Filtre avancé
                {nbFiltresActifs > 0 && (
                  <span className="inline-flex items-center justify-center min-w-4 h-4 rounded-full bg-accent text-accent-contrast text-[10px] font-bold px-1">
                    {nbFiltresActifs}
                  </span>
                )}
              </button>
            )}
            {!derniersJours && <BoutonExport icone={Upload} label="Export" onClick={(e) => ouvrirExport(e)} />}
            {actions}
          </>
        }
      />

      {/* Numéro recherché (clic droit sur la colonne) : seule raison d'afficher une ligne de filtre.
          La période et les filtres appliqués s'affichent au survol de « Filtre avancé », pour garder la place au tableau. */}
      {numero && (
        <div className="shrink-0 flex items-center gap-2 flex-wrap">
          {numero && (
            <span className="inline-flex items-center gap-1.5 h-[26px] rounded-full border border-accent bg-accent-soft px-2.5 text-xs font-semibold text-accent-deep">
              {config.colonneNumero?.titre} : {numero} <span className="font-normal">(toutes dates)</span>
              <button onClick={() => setNumero('')} title="Retirer le filtre" className="hover:text-danger">
                <X size={13} strokeWidth={1.75} />
              </button>
            </span>
          )}
        </div>
      )}

      <BandeauErreur message={erreur} className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2" />

      {/* Liste */}
      <div
        className="flex-1 min-h-[160px] bg-card rounded-lg border border-border overflow-auto"
        onContextMenu={(e) => {
          if (elementsMenuTableau && elementsMenuTableau.length > 0) ouvrirMenu(e, elementsMenuTableau)
        }}
      >
        <table className="tableau-dense tableau-ajuste">
          <Largeurs colonnes={colonnesEcran} />
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
              {colonnesEcran.map((c) => (
                <th
                  key={c.titre}
                  onContextMenu={numeroEstColonne(c) ? ouvrirSaisieNumero : undefined}
                  title={numeroEstColonne(c) ? 'Clic droit pour rechercher un numéro' : undefined}
                  className={`font-semibold h-8 px-3 whitespace-nowrap ${c.droite ? 'text-right' : ''} ${
                    numeroEstColonne(c) ? 'cursor-context-menu' : ''
                  }`}
                >
                  {c.titre}
                </th>
              ))}
            </tr>
          </thead>
          {/* Lignes qui « roulent » comme une roue en entrant et en sortant de la zone visible. */}
          <tbody className="defilement-roue">
            {documentsAffiches.map((d) => (
              <tr
                key={d.id}
                // Un clic n'importe où sur la ligne ouvre le détail du document (s'il en a un).
                onClick={() => {
                  setSelectionId(d.id)
                  if (config.lignes) setDetail(d)
                }}
                className={`h-9 border-t border-border transition-colors ${config.lignes ? 'cursor-pointer' : ''} ${
                  selectionId === d.id
                    ? 'bg-accent-soft'
                    : config.lignes
                      ? 'hover:bg-accent-soft/60'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                } ${idEnSurbrillance === d.id ? 'font-semibold' : ''}`}
              >
                {colonnesEcran.map((c) => (
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

      {/* Fiche complète + exports (clic sur une ligne) : le tableau prend toute la hauteur. */}
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

      {brouillon && (
        <PanneauFiltres
          onFermer={() => setBrouillon(null)}
          onReinitialiser={() => setBrouillon({ ...brouillon, periode: '30', ...datesPeriode('30'), depots: [], types: [], produit: '' })}
          onAppliquer={() => {
            setFiltre(brouillon)
            setBrouillon(null)
          }}
        >
          <SectionFiltre titre="Période" resume={libellePeriode(brouillon)} ouvertParDefaut>
            <div className="flex flex-wrap gap-1">
              {PERIODES.map((pe) => (
                <button
                  key={pe.id}
                  type="button"
                  onClick={() => setBrouillon({ ...brouillon, periode: pe.id, ...datesPeriode(pe.id) })}
                  className={`h-[26px] px-2.5 rounded-md text-xs font-medium border transition-all ${
                    brouillon.periode === pe.id ? 'fiche-pastille-active border-accent/60 text-text' : 'border-border bg-card text-text-muted hover:text-text'
                  }`}
                >
                  {pe.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex flex-col gap-1">
                <span className={CLASSE_LABEL}>Du</span>
                <input
                  type="date"
                  value={brouillon.du}
                  max={brouillon.au || undefined}
                  onChange={(e) => setBrouillon({ ...brouillon, du: e.target.value, periode: 'perso' })}
                  className={CLASSE_CHAMP_COMPACT}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={CLASSE_LABEL}>Au</span>
                <input
                  type="date"
                  value={brouillon.au}
                  min={brouillon.du || undefined}
                  onChange={(e) => setBrouillon({ ...brouillon, au: e.target.value, periode: 'perso' })}
                  className={CLASSE_CHAMP_COMPACT}
                />
              </label>
            </div>
          </SectionFiltre>
          {config.typesFiltre && (
            <SectionFiltre
              titre="Types de mouvement"
              resume={brouillon.types.length === 0 || brouillon.types.length === config.typesFiltre.length ? 'Tous' : `${brouillon.types.length} sur ${config.typesFiltre.length}`}
              ouvertParDefaut
            >
              <CaseFiltre
                libelle={<span className="font-medium">Tous les types</span>}
                coche={brouillon.types.length === config.typesFiltre.length}
                onChange={(c) => setBrouillon({ ...brouillon, types: c ? config.typesFiltre!.map((t) => t.id) : [] })}
              />
              {config.typesFiltre.map((t) => (
                <CaseFiltre
                  key={t.id}
                  libelle={t.label}
                  coche={brouillon.types.includes(t.id)}
                  onChange={(c) => setBrouillon({ ...brouillon, types: basculer(brouillon.types, t.id, c) })}
                />
              ))}
            </SectionFiltre>
          )}
          {avecProduit && (
            <SectionFiltre titre="Produit" resume={brouillon.produit.trim() || 'Tous'} ouvertParDefaut={Boolean(config.typesFiltre)}>
              <input
                value={brouillon.produit}
                onChange={(e) => setBrouillon({ ...brouillon, produit: e.target.value })}
                placeholder="Code ou nom (* en tête = contient)"
                className={CLASSE_CHAMP_COMPACT}
              />
            </SectionFiltre>
          )}
          {depotsDisponibles.length > 0 && (
            <SectionFiltre titre="Dépôts" resume={brouillon.depots.length === 0 ? 'Tous' : `${brouillon.depots.length} sur ${depotsDisponibles.length}`}>
              {depotsDisponibles.map((nom) => (
                <CaseFiltre
                  key={nom}
                  libelle={nom}
                  coche={brouillon.depots.includes(nom)}
                  onChange={(c) => setBrouillon({ ...brouillon, depots: basculer(brouillon.depots, nom, c) })}
                />
              ))}
            </SectionFiltre>
          )}
        </PanneauFiltres>
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

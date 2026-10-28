import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { ClipboardCheck, Clock, FileDown, FileSpreadsheet, PackageX, Plus, ShieldAlert, Wallet } from 'lucide-react'
import { useTabs } from '../context/TabsContext'
import { useToast } from '../context/ToastContext'
import { messageErreur } from '../lib/erreurs'
import {
  getNonConformites,
  getTraitementsNc,
  libelleDecision,
  libelleMotif,
  MOTIFS_NC,
  ORIGINES_NC,
  STATUTS_NC,
  type NonConformite,
  type TraitementNc,
} from '../lib/api/quarantaine'
import { exporterCsv, exporterExcel, type ValeurExport } from '../lib/export/fichiers'
import { KpiCard } from '../components/dashboard/KpiCard'
import { EnTetePage } from '../components/ui/EnTetePage'
import { Badge } from '../components/ui/Badge'
import { useMenuContextuel } from '../components/ui/MenuContextuel'
import { CLASSE_BOUTON_PRIMAIRE_PETIT, CLASSE_CHAMP_COMPACT, CLASSE_LABEL } from '../components/ui/styles'
import { TraitementModal } from '../components/quarantaine/TraitementModal'
import { RechercheTraitementModal } from '../components/quarantaine/RechercheTraitementModal'
import { ChampRecherche } from '../components/ui/ChampRecherche'
import { DeclarationModal } from '../components/quarantaine/DeclarationModal'

type FiltreStatut = 'actifs' | 'clotures' | 'tous'

const SEUIL_ALERTE_JOURS = 15
const SEUIL_CRITIQUE_JOURS = 30

function dateHeure(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
}

function Anciennete({ jours, cloture }: { jours: number; cloture: boolean }) {
  if (cloture) return <span className="text-text-muted">{jours} j</span>
  const ton = jours > SEUIL_CRITIQUE_JOURS ? 'danger' : jours > SEUIL_ALERTE_JOURS ? 'alerte' : 'neutre'
  return <Badge ton={ton}>{jours} j</Badge>
}

const COLONNES_EXPORT: { titre: string; largeur?: number; valeur: (d: NonConformite) => ValeurExport }[] = [
  { titre: 'N° NC', largeur: 16, valeur: (d) => d.numero },
  { titre: 'Date', largeur: 18, valeur: (d) => new Date(d.cree_le) },
  { titre: 'Statut', largeur: 14, valeur: (d) => STATUTS_NC[d.statut].label },
  { titre: 'Ancienneté (jours)', largeur: 12, valeur: (d) => d.age_jours },
  { titre: 'Dépôt', largeur: 18, valeur: (d) => d.entrepot_nom },
  { titre: 'Référence', largeur: 16, valeur: (d) => d.produit_reference },
  { titre: 'Désignation', largeur: 32, valeur: (d) => d.produit_designation },
  { titre: 'Lot', largeur: 14, valeur: (d) => d.lot },
  { titre: 'N° série', largeur: 14, valeur: (d) => d.numero_serie },
  { titre: 'Motif', largeur: 24, valeur: (d) => libelleMotif(d.motif) },
  { titre: 'Constat', largeur: 36, valeur: (d) => d.constat },
  { titre: 'Fournisseur', largeur: 22, valeur: (d) => d.fournisseur_nom },
  { titre: 'N° commande', largeur: 14, valeur: (d) => d.numero_po },
  { titre: 'Réception', largeur: 16, valeur: (d) => d.reception_numero },
  { titre: 'Qté initiale', largeur: 10, valeur: (d) => d.quantite_initiale },
  { titre: 'Qté restante', largeur: 10, valeur: (d) => d.quantite_restante },
  { titre: 'Dont en réparation', largeur: 12, valeur: (d) => d.quantite_en_reparation },
  { titre: 'Valeur bloquée (XOF)', largeur: 14, valeur: (d) => d.valeur_bloquee },
  { titre: 'Origine', largeur: 18, valeur: (d) => ORIGINES_NC[d.origine] ?? d.origine },
  { titre: 'Déclaré par', largeur: 22, valeur: (d) => d.declare_par_nom },
]

/**
 * Suivi de la quarantaine : un dossier de non-conformité par mise en
 * quarantaine, avec indicateurs, filtres, historique des traitements et
 * l'outil "Traitement" qui met le stock à jour.
 */
export function Quarantaine() {
  const { ongletActifId } = useTabs()
  const { afficherToast } = useToast()
  const [dossiers, setDossiers] = useState<NonConformite[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('actifs')
  const [filtreDepot, setFiltreDepot] = useState('')
  const [filtreMotif, setFiltreMotif] = useState('')
  const [recherche, setRecherche] = useState('')
  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [traitements, setTraitements] = useState<TraitementNc[]>([])
  const [aTraiter, setATraiter] = useState<NonConformite | null>(null)
  const [rechercheOuverte, setRechercheOuverte] = useState(false)
  const [declarationOuverte, setDeclarationOuverte] = useState(false)
  const [jeton, setJeton] = useState(0)
  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()
  const estActif = ongletActifId === 'quarantaine'

  useEffect(() => {
    if (!estActif) return
    let annule = false
    getNonConformites()
      .then((d) => {
        if (annule) return
        setDossiers(d)
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
  }, [estActif, jeton])

  useEffect(() => {
    if (!selectionId) return
    getTraitementsNc(selectionId)
      .then(setTraitements)
      .catch((e) => setErreur(messageErreur(e)))
  }, [selectionId, jeton])

  const actifs = useMemo(() => dossiers.filter((d) => d.statut !== 'cloturee'), [dossiers])
  const depots = useMemo(() => [...new Map(dossiers.map((d) => [d.entrepot_id, d.entrepot_nom])).entries()], [dossiers])

  const lignes = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return dossiers.filter(
      (d) =>
        (filtreStatut === 'tous' || (filtreStatut === 'actifs' ? d.statut !== 'cloturee' : d.statut === 'cloturee')) &&
        (!filtreDepot || d.entrepot_id === filtreDepot) &&
        (!filtreMotif || d.motif === filtreMotif) &&
        (!terme ||
          [d.numero, d.numero_po, d.produit_reference, d.produit_designation, d.fournisseur_nom, d.lot, d.numero_serie, d.reception_numero]
            .some((v) => v != null && v.toLowerCase().includes(terme))),
    )
  }, [dossiers, filtreStatut, filtreDepot, filtreMotif, recherche])

  const selection = dossiers.find((d) => d.id === selectionId) ?? null
  const unitesBloquees = actifs.reduce((total, d) => total + d.quantite_restante, 0)
  const valeurBloquee = actifs.reduce((total, d) => total + d.valeur_bloquee, 0)
  const anciens = actifs.filter((d) => d.age_jours > SEUIL_CRITIQUE_JOURS).length

  function apresAction(message: string) {
    afficherToast(message)
    setATraiter(null)
    setDeclarationOuverte(false)
    setJeton((j) => j + 1)
  }

  function onClicDroitLigne(e: MouseEvent, d: NonConformite) {
    setSelectionId(d.id)
    ouvrirMenu(e, d.statut === 'cloturee' ? [] : [{ label: 'Traiter ce dossier', onClick: () => setATraiter(d) }])
  }

  function exporter(format: 'excel' | 'csv') {
    const colonnes = COLONNES_EXPORT.map((c) => ({ titre: c.titre, largeur: c.largeur }))
    const donnees = lignes.map((d) => COLONNES_EXPORT.map((c) => c.valeur(d)))
    const nom = `Quarantaine_${new Date().toISOString().slice(0, 10)}`
    if (format === 'csv') exporterCsv(nom, colonnes, donnees)
    else exporterExcel(nom, colonnes, donnees, 'Quarantaine').catch((e) => setErreur(messageErreur(e)))
  }

  return (
    <div className="h-full flex flex-col gap-3 p-[var(--content-padding)] min-h-0 overflow-y-auto">
      <EnTetePage titre="Quarantaine" compteur={lignes.length} />

      {/* Indicateurs */}
      <div className="shrink-0 grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard icone={ShieldAlert} label="Dossiers ouverts" valeur={String(actifs.length)} indication="Non-conformités à traiter" tonalite="danger" />
        <KpiCard icone={PackageX} label="Unités bloquées" valeur={unitesBloquees.toLocaleString('fr-FR')} indication="Hors stock disponible" tonalite="alerte" />
        <KpiCard
          icone={Wallet}
          label="Valeur bloquée"
          valeur={`${valeurBloquee.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF`}
          indication="Au prix de réception"
          tonalite="neutre"
        />
        <KpiCard
          icone={Clock}
          label={`Plus de ${SEUIL_CRITIQUE_JOURS} jours`}
          valeur={String(anciens)}
          indication="Dossiers à relancer en priorité"
          tonalite={anciens > 0 ? 'danger' : 'succes'}
        />
      </div>

      {/* Barre d'outils */}
      <div className="shrink-0 flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {(
              [
                ['actifs', `En cours (${actifs.length})`],
                ['clotures', 'Clôturés'],
                ['tous', 'Tous'],
              ] as [FiltreStatut, string][]
            ).map(([valeur, label]) => (
              <button
                key={valeur}
                onClick={() => setFiltreStatut(valeur)}
                className={`inline-flex items-center rounded-full border px-2.5 h-7 text-xs font-semibold transition-colors ${
                  filtreStatut === valeur ? 'bg-accent-soft border-accent text-accent-deep' : 'bg-card border-border text-text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 w-[170px]">
            <span className={CLASSE_LABEL}>Dépôt</span>
            <select value={filtreDepot} onChange={(e) => setFiltreDepot(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
              <option value="">Tous</option>
              {depots.map(([id, nom]) => (
                <option key={id} value={id}>
                  {nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 w-[190px]">
            <span className={CLASSE_LABEL}>Motif</span>
            <select value={filtreMotif} onChange={(e) => setFiltreMotif(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
              <option value="">Tous</option>
              {MOTIFS_NC.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <ChampRecherche valeur={recherche} onChange={setRecherche} aide="Dossier, commande, référence, fournisseur, lot..." />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exporter('excel')}
            className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-text text-xs font-semibold rounded-lg px-3 h-8"
          >
            <FileSpreadsheet size={14} strokeWidth={1.75} /> Excel
          </button>
          <button
            type="button"
            onClick={() => exporter('csv')}
            className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-text text-xs font-semibold rounded-lg px-3 h-8"
          >
            <FileDown size={14} strokeWidth={1.75} /> CSV
          </button>
          <button
            type="button"
            onClick={() => setDeclarationOuverte(true)}
            className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-text text-xs font-semibold rounded-lg px-3 h-8"
          >
            <Plus size={14} strokeWidth={1.75} /> Déclarer une non-conformité
          </button>
          <button type="button" onClick={() => setRechercheOuverte(true)} className={`${CLASSE_BOUTON_PRIMAIRE_PETIT} h-8`}>
            <ClipboardCheck size={14} strokeWidth={1.75} /> Traitement
          </button>
        </div>
      </div>

      {erreur && <div className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}

      {/* Liste des dossiers */}
      <div className="flex-1 min-h-[200px] bg-card rounded-lg border border-border overflow-auto">
        <table className="tableau-dense tableau-ajuste">
          <colgroup><col style={{ width: '9%' }} /><col style={{ width: '10%' }} /><col style={{ width: '5%' }} /><col style={{ width: '8%' }} /><col style={{ width: '14%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} /></colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
              <th className="font-semibold h-8 px-3">N° NC</th>
              <th className="font-semibold h-8 px-3">Date</th>
              <th className="font-semibold h-8 px-3">Âge</th>
              <th className="font-semibold h-8 px-3">Référence</th>
              <th className="font-semibold h-8 px-3">Désignation</th>
              <th className="font-semibold h-8 px-3">Lot / Série</th>
              <th className="font-semibold h-8 px-3 text-right">Qté</th>
              <th className="font-semibold h-8 px-3">Motif</th>
              <th className="font-semibold h-8 px-3">Fournisseur</th>
              <th className="font-semibold h-8 px-3">N° commande</th>
              <th className="font-semibold h-8 px-3">Réception</th>
              <th className="font-semibold h-8 px-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((d) => (
              <tr
                key={d.id}
                onClick={() => setSelectionId(d.id)}
                onDoubleClick={() => d.statut !== 'cloturee' && setATraiter(d)}
                onContextMenu={(e) => onClicDroitLigne(e, d)}
                className={`h-9 border-t border-border cursor-pointer whitespace-nowrap ${
                  selectionId === d.id ? 'bg-accent-soft' : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <td className="px-3 font-mono text-xs text-text-muted">{d.numero}</td>
                <td className="px-3 text-text-muted">{dateHeure(d.cree_le)}</td>
                <td className="px-3">
                  <Anciennete jours={d.age_jours} cloture={d.statut === 'cloturee'} />
                </td>
                <td className="px-3 font-mono text-xs text-text">{d.produit_reference}</td>
                <td className="px-3 font-medium text-text max-w-[220px] truncate" title={d.produit_designation}>
                  {d.produit_designation}
                </td>
                <td className="px-3 font-mono text-xs text-text-muted">{d.lot ?? d.numero_serie ?? '—'}</td>
                <td className="px-3 text-right">
                  <span className="font-semibold text-text">{d.quantite_restante}</span>
                  <span className="text-text-muted"> / {d.quantite_initiale}</span>
                  {d.quantite_en_reparation > 0 && (
                    <span className="block text-[11px] text-warn-deep">dont {d.quantite_en_reparation} en réparation</span>
                  )}
                </td>
                <td className="px-3 text-text">{libelleMotif(d.motif)}</td>
                <td className="px-3 text-text-muted">{d.fournisseur_nom ?? '—'}</td>
                <td className="px-3 font-mono text-xs text-text-muted">{d.numero_po ?? '—'}</td>
                <td className="px-3 font-mono text-xs text-text-muted">{d.reception_numero ?? '—'}</td>
                <td className="px-3">
                  <Badge ton={STATUTS_NC[d.statut].ton}>{STATUTS_NC[d.statut].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!chargement && lignes.length === 0 && (
          <p className="text-sm text-text-muted py-10 text-center">
            {dossiers.length === 0 ? 'Aucun produit en quarantaine.' : 'Aucun dossier ne correspond aux filtres.'}
          </p>
        )}
        {chargement && <p className="text-sm text-text-muted py-10 text-center">Chargement...</p>}
      </div>

      {/* Fiche du dossier sélectionné */}
      {selection && (
        <div className="shrink-0 bg-card rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-text uppercase tracking-wide">
              Dossier {selection.numero} · {selection.produit_designation}
            </span>
            {selection.statut !== 'cloturee' && (
              <button type="button" onClick={() => setATraiter(selection)} className={CLASSE_BOUTON_PRIMAIRE_PETIT}>
                <ClipboardCheck size={13} strokeWidth={1.75} /> Traiter ce dossier
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 p-3 max-h-[30vh] overflow-auto">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 content-start">
              {[
                ['Constat', selection.constat ?? '—'],
                ['Origine', ORIGINES_NC[selection.origine] ?? selection.origine],
                ['Déclaré par', selection.declare_par_nom ?? '—'],
                ['Dépôt', selection.entrepot_nom],
                ['Expiration', selection.date_expiration ? new Date(selection.date_expiration).toLocaleDateString('fr-FR') : '—'],
                ['Valeur bloquée', `${selection.valeur_bloquee.toLocaleString('fr-FR')} XOF`],
                ['Clôturé le', selection.cloture_le ? dateHeure(selection.cloture_le) : '—'],
              ].map(([titre, valeur]) => (
                <div key={titre} className={`flex flex-col gap-0.5 min-w-0 ${titre === 'Constat' ? 'col-span-2' : ''}`}>
                  <dt className={CLASSE_LABEL}>{titre}</dt>
                  <dd className="text-[13px] text-text">{valeur}</dd>
                </div>
              ))}
            </dl>
            <div className="min-w-0">
              <div className={`${CLASSE_LABEL} mb-1.5`}>Traitements</div>
              {traitements.length === 0 ? (
                <p className="text-xs text-text-muted py-3">Aucun traitement pour l'instant.</p>
              ) : (
                <table className="tableau-dense">
                  <thead>
                    <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                      <th className="font-semibold h-7 px-2">Date</th>
                      <th className="font-semibold h-7 px-2">Décision</th>
                      <th className="font-semibold h-7 px-2 text-right">Qté</th>
                      <th className="font-semibold h-7 px-2">Destination / document</th>
                      <th className="font-semibold h-7 px-2">Commentaire</th>
                      <th className="font-semibold h-7 px-2">Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traitements.map((t) => (
                      <tr key={t.id} className="border-t border-border align-top">
                        <td className="px-2 py-1.5 text-text-muted whitespace-nowrap">{dateHeure(t.cree_le)}</td>
                        <td className="px-2 py-1.5 text-text font-medium whitespace-nowrap">
                          {libelleDecision(t.decision)}
                          {t.source === 'reparation' && <span className="block text-[11px] text-text-muted">retour de réparation</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold text-text">{t.quantite}</td>
                        <td className="px-2 py-1.5 font-mono text-text-muted">
                          {[t.emplacement_destination_code, t.reference_document].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-text">{t.commentaire}</td>
                        <td className="px-2 py-1.5 text-text-muted whitespace-nowrap">{t.traite_par_nom ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {rechercheOuverte && (
        <RechercheTraitementModal
          dossiers={dossiers}
          onFermer={() => setRechercheOuverte(false)}
          onChoisir={(d) => {
            setRechercheOuverte(false)
            setSelectionId(d.id)
            setATraiter(d)
          }}
        />
      )}
      {aTraiter && <TraitementModal dossier={aTraiter} onFermer={() => setATraiter(null)} onTraite={apresAction} />}
      {declarationOuverte && (
        <DeclarationModal
          onFermer={() => setDeclarationOuverte(false)}
          onDeclare={(id) => {
            setSelectionId(id)
            apresAction('Non-conformité déclarée : le produit est en quarantaine')
          }}
        />
      )}
      {menu}
    </div>
  )
}

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronRight, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSaisieEnCours, useTabs } from '../context/TabsContext'
import { useConfirmation } from '../context/ConfirmationContext'
import { useToast } from '../context/ToastContext'
import { messageErreur } from '../lib/erreurs'
import { peutReintegrer } from '../lib/permissions'
import { texteFiltre } from '../lib/filtreTexte'
import { dateVersInput, dateSaisieVersISO } from '../lib/dates'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { creerReintegration, getSortiesAReintegrer } from '../lib/api/reintegrations'
import type { Emplacement, Entrepot, SortieAReintegrer } from '../types/stock'
import { BandeauErreur } from '../components/ui/BandeauErreur'
import { CLASSE_BOUTON_PRIMAIRE, CLASSE_CHAMP_COMPACT, CLASSE_CHAMP_LECTURE, CLASSE_LABEL } from '../components/ui/styles'

/** Une ligne du panier : une ligne de sortie, la quantité qui revient et où elle est rangée. */
interface LignePanier {
  cle: string
  ligne: SortieAReintegrer
  /** Saisie par l'opérateur (vide au départ). */
  quantite: string
  emplacementId: string
}

/** Un bon de sortie qui a encore quelque chose à réintégrer, avec ses lignes. */
interface BonAReintegrer {
  id: string
  numero: string
  date: string
  recuPar: string | null
  motif: string | null
  lignes: SortieAReintegrer[]
}

const TOUS = ''

function libelleLot(l: Pick<SortieAReintegrer, 'lot' | 'numero_serie'>): string {
  if (l.lot && l.numero_serie) return `${l.lot} / ${l.numero_serie}`
  return l.lot ?? l.numero_serie ?? ''
}

const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

/** Case en erreur : fond rouge, bulle qui dit quoi faire au survol ou quand le curseur y est. */
function CaseErreur({ erreur, children, className = '' }: { erreur: string | null; children: ReactNode; className?: string }) {
  return (
    <td className={`relative group/case ${className} ${erreur ? 'bg-danger-soft/60' : ''}`} aria-invalid={erreur ? true : undefined}>
      {children}
      {erreur && (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-2 top-full z-20 -mt-1 hidden whitespace-nowrap rounded-md bg-danger px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover/case:block group-focus-within/case:block"
        >
          {erreur}
        </span>
      )}
    </td>
  )
}

/**
 * Réintégration (retour en stock de tout ou partie d'une sortie), en deux vues :
 * - « Choix » : les bons de sortie qui ont encore quelque chose à réintégrer ;
 *   cocher un bon prend toutes ses lignes, le déplier permet d'en choisir
 *   certaines ; puis « Ajouter » ;
 * - « Panier » : l'opérateur saisit les quantités qui reviennent et où elles
 *   sont rangées (par défaut l'emplacement d'origine), puis valide.
 * Une réintégration peut couvrir plusieurs dépôts : chaque ligne revient dans
 * le dépôt d'où elle est sortie.
 */
export function Reintegration() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ongletActifId } = useTabs()
  const { confirmer } = useConfirmation()
  const { afficherToast } = useToast()

  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [depotChoisi, setDepotChoisi] = useState(TOUS)
  const [lignesDispo, setLignesDispo] = useState<SortieAReintegrer[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [vue, setVue] = useState<'choix' | 'panier'>('choix')
  const [recherche, setRecherche] = useState('')
  /** Lignes de sortie cochées dans la vue « Choix ». */
  const [coches, setCoches] = useState<Set<string>>(new Set())
  const [deplies, setDeplies] = useState<Set<string>>(new Set())

  const [panier, setPanier] = useState<LignePanier[]>([])
  const [tentative, setTentative] = useState(false)
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [avecNote, setAvecNote] = useState(false)
  const [notes, setNotes] = useState('')
  const [envoi, setEnvoi] = useState(false)
  // Panier ou cases cochées non validés : confirmation avant de fermer l'onglet.
  useSaisieEnCours('reintegration', panier.length > 0 || coches.size > 0)

  const rechercheRef = useRef<HTMLInputElement>(null)
  const panierRef = useRef<HTMLDivElement>(null)
  const estActif = ongletActifId === 'reintegration'

  function charger() {
    getEntrepots()
      .then(async (e) => {
        const autorises = e.filter((ent) => peutReintegrer(profil?.role, ent.id, entrepotsAssignes))
        setEntrepots(autorises)
        const [lignes, parDepot] = await Promise.all([
          getSortiesAReintegrer(null),
          Promise.all(autorises.map((ent) => getEmplacements(ent.id))),
        ])
        const depots = new Set(autorises.map((a) => a.id))
        setLignesDispo(lignes.filter((l) => depots.has(l.entrepot_id)))
        // Localisations de retour possibles, la Quarantaine exclue.
        setEmplacements(parDepot.flat().filter((em) => !em.est_quarantaine))
      })
      .catch((e) => setErreur(messageErreur(e)))
      .finally(() => setChargement(false))
  }

  // Les onglets restent montés en arrière-plan : on recharge à chaque retour (une sortie a pu être faite entre-temps).
  useEffect(() => {
    if (estActif) charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estActif])

  const nomDepot = (id: string) => entrepots.find((e) => e.id === id)?.nom ?? '—'
  const dansPanier = useMemo(() => new Set(panier.map((p) => p.ligne.bon_sortie_ligne_id)), [panier])

  // Bons de sortie (filtrés par dépôt et par la recherche), du plus récent au plus ancien.
  const bons = useMemo(() => {
    const parBon = new Map<string, BonAReintegrer>()
    for (const l of lignesDispo) {
      if (depotChoisi !== TOUS && l.entrepot_id !== depotChoisi) continue
      const bon = parBon.get(l.bon_sortie_id) ?? {
        id: l.bon_sortie_id,
        numero: l.bon_sortie_numero,
        date: l.sortie_le,
        recuPar: l.recu_par,
        motif: l.motif,
        lignes: [],
      }
      bon.lignes.push(l)
      parBon.set(l.bon_sortie_id, bon)
    }
    const terme = recherche.trim()
    return [...parBon.values()]
      .filter(
        (b) =>
          !terme ||
          texteFiltre(b.numero, terme) ||
          texteFiltre(b.recuPar ?? '', terme) ||
          b.lignes.some((l) => texteFiltre(l.produit_reference, terme) || texteFiltre(l.produit_designation, terme)),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [lignesDispo, depotChoisi, recherche])

  /** Lignes d'un bon encore cochables (pas déjà au panier). */
  const libres = (b: BonAReintegrer) => b.lignes.filter((l) => !dansPanier.has(l.bon_sortie_ligne_id))

  function cocherLignes(ids: string[], coche: boolean) {
    setCoches((prev) => {
      const suivant = new Set(prev)
      for (const id of ids) {
        if (coche) suivant.add(id)
        else suivant.delete(id)
      }
      return suivant
    })
  }

  function basculerDeplie(id: string) {
    setDeplies((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  // Vue « Choix » → panier : les lignes cochées passent au panier (quantité à saisir), les cases se vident.
  function ajouterAuPanier() {
    const nouvelles = lignesDispo
      .filter((l) => coches.has(l.bon_sortie_ligne_id) && !dansPanier.has(l.bon_sortie_ligne_id))
      .map((l) => ({
        cle: Math.random().toString(36).slice(2),
        ligne: l,
        quantite: '',
        // Par défaut, le produit revient là d'où il est sorti.
        emplacementId:
          (l.emplacement_id && emplacements.some((e) => e.id === l.emplacement_id) ? l.emplacement_id : null) ??
          emplacements.find((e) => e.entrepot_id === l.entrepot_id)?.id ??
          '',
      }))
    setPanier((prev) => [...prev, ...nouvelles])
    setCoches(new Set())
    setRecherche('')
    setErreur(null)
    setVue('panier')
    setTimeout(() => panierRef.current?.querySelector<HTMLInputElement>('input[data-quantite]')?.focus(), 60)
  }

  function majLigne(cle: string, champs: Partial<LignePanier>) {
    setPanier((prev) => prev.map((p) => (p.cle === cle ? { ...p, ...champs } : p)))
    setErreur(null)
  }

  /** Problème de quantité (null = correct). « Manquante » seulement après un essai de validation. */
  function erreurQuantite(p: LignePanier): string | null {
    const texte = p.quantite.trim()
    if (!texte) return tentative ? 'Quantité à réintégrer manquante' : null
    const n = Number(texte)
    if (!Number.isInteger(n) || n <= 0) return 'Nombre entier plus grand que 0'
    if (n > p.ligne.quantite_disponible) return `Au plus ${p.ligne.quantite_disponible}`
    return null
  }

  async function viderPanier() {
    const ok = await confirmer({
      titre: 'Vider le panier ?',
      message: `Les ${panier.length} ligne(s) du panier seront retirées. Rien ne revient en stock.`,
      libelleConfirmer: 'Vider le panier',
      danger: true,
    })
    if (!ok) return
    setPanier([])
    setTentative(false)
    setErreur(null)
    setVue('choix')
  }

  async function onValider() {
    if (panier.length === 0) return
    setTentative(true)
    const enErreur = panier.find((p) => {
      const n = Number(p.quantite.trim())
      return !p.quantite.trim() || !Number.isInteger(n) || n <= 0 || n > p.ligne.quantite_disponible || !p.emplacementId
    })
    if (enErreur) {
      setTimeout(() => panierRef.current?.querySelector<HTMLInputElement>(`input[data-quantite="${enErreur.cle}"]`)?.focus(), 30)
      return
    }
    const unites = panier.reduce((t, p) => t + Number(p.quantite), 0)
    const depots = [...new Set(panier.map((p) => nomDepot(p.ligne.entrepot_id)))]
    const ok = await confirmer({
      titre: 'Valider la réintégration ?',
      message: `${panier.length} ligne(s), ${unites.toLocaleString('fr-FR')} unité(s) vont revenir en stock (${depots.join(', ')}). Une réintégration validée ne peut plus être modifiée.`,
      libelleConfirmer: 'Valider la réintégration',
    })
    if (!ok) return
    setErreur(null)
    setEnvoi(true)
    try {
      const numero = await creerReintegration(
        depotChoisi === TOUS ? panier[0].ligne.entrepot_id : depotChoisi,
        avecNote ? notes.trim() || null : null,
        panier.map((p) => ({ bonSortieLigneId: p.ligne.bon_sortie_ligne_id, emplacementId: p.emplacementId, quantite: Number(p.quantite) })),
        dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
      )
      afficherToast(`Réintégration effectuée : ${numero}`)
      setPanier([])
      setTentative(false)
      setNotes('')
      setAvecNote(false)
      setVue('choix')
      charger()
    } catch (err) {
      setErreur(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  if (chargement) {
    return <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
  }

  const nbACorriger = panier.filter((p) => erreurQuantite(p) != null).length
  const quantiteTotale = panier.reduce((t, p) => t + (Number(p.quantite) || 0), 0)

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 min-h-0">
      {/* En-tête compact sur une ligne. */}
      <div className="shrink-0 bg-muted/50 rounded-lg border border-border px-3 py-2 flex items-end gap-4 flex-wrap">
        <label className="flex flex-col gap-1 w-[200px]">
          <span className={CLASSE_LABEL}>Dépôt</span>
          <select value={depotChoisi} onChange={(e) => setDepotChoisi(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
            <option value={TOUS}>Tous les dépôts</option>
            {entrepots.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 w-[180px]">
          <span className={CLASSE_LABEL}>Opérateur</span>
          <div className={CLASSE_CHAMP_LECTURE}>{profil?.nom_complet ?? '—'}</div>
        </div>
        <label className="flex flex-col gap-1 w-[150px]">
          <span className={CLASSE_LABEL}>Date du mouvement</span>
          <input
            type="date"
            value={dateMouvement}
            max={dateVersInput(new Date())}
            onChange={(e) => setDateMouvement(e.target.value)}
            className={CLASSE_CHAMP_COMPACT}
          />
        </label>
        <label className="h-[30px] flex items-center gap-1.5 text-xs text-text cursor-pointer select-none">
          <input type="checkbox" checked={avecNote} onChange={(e) => setAvecNote(e.target.checked)} className="accent-[var(--accent)]" />
          Ajouter une note
        </label>
        {avecNote && (
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoFocus
            placeholder="Note (ex. retour de chantier)"
            className={`${CLASSE_CHAMP_COMPACT} flex-1 min-w-[220px]`}
          />
        )}
      </div>

      <BandeauErreur
        message={erreur ?? (vue === 'panier' && tentative && nbACorriger > 0 ? `${nbACorriger} ligne(s) à corriger : complète les quantités en rouge.` : null)}
        className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2"
      />

      {vue === 'choix' ? (
        <>
          {/* Vue « Choix » : les bons de sortie à réintégrer. */}
          <div className="shrink-0 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 border border-border rounded-lg px-3 h-10 bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
              <Search size={16} strokeWidth={1.75} className="text-text-muted shrink-0" />
              <input
                ref={rechercheRef}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Recherche"
                title="N° de bon, référence, désignation ou « Reçu par » ; * devant un mot = contient"
                className="text-[13px] bg-transparent text-text placeholder:text-text-muted outline-none w-full"
              />
              {recherche && (
                <button type="button" onClick={() => setRecherche('')} className="text-text-muted hover:text-text" title="Effacer">
                  <X size={14} strokeWidth={1.75} />
                </button>
              )}
            </div>
            {panier.length > 0 && (
              <button
                type="button"
                onClick={() => setVue('panier')}
                className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border bg-card text-[13px] font-semibold text-text hover:bg-muted"
                title="Voir le panier"
              >
                <ShoppingCart size={15} strokeWidth={1.75} /> Panier
                <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-accent text-accent-contrast text-[11px] font-bold px-1.5">
                  {panier.length}
                </span>
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto defilement-fin">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                    <th className="h-8 px-3 w-10" />
                    <th className="h-8 w-8" />
                    <th className="font-semibold h-8 px-3">N° de bon</th>
                    <th className="font-semibold h-8 px-3">Date</th>
                    <th className="font-semibold h-8 px-3">Reçu par</th>
                    <th className="font-semibold h-8 px-3">Motif</th>
                    <th className="font-semibold h-8 px-3 text-right">Lignes</th>
                    <th className="font-semibold h-8 px-3 text-right">À réintégrer</th>
                  </tr>
                </thead>
                <tbody>
                  {bons.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-text-muted text-center py-8">
                        Aucune sortie à réintégrer.
                      </td>
                    </tr>
                  )}
                  {bons.map((b) => {
                    const lignesLibres = libres(b)
                    const toutAuPanier = lignesLibres.length === 0
                    const nbCoches = lignesLibres.filter((l) => coches.has(l.bon_sortie_ligne_id)).length
                    const bonCoche = !toutAuPanier && nbCoches === lignesLibres.length
                    const deplie = deplies.has(b.id)
                    const reste = b.lignes.reduce((t, l) => t + l.quantite_disponible, 0)
                    return (
                      <Fragment key={b.id}>
                        <tr
                          onClick={() => !toutAuPanier && cocherLignes(lignesLibres.map((l) => l.bon_sortie_ligne_id), !bonCoche)}
                          title={toutAuPanier ? 'Déjà au panier' : undefined}
                          className={`h-10 border-t border-border ${
                            toutAuPanier ? 'bg-muted/60' : bonCoche || nbCoches > 0 ? 'bg-accent-soft/60 cursor-pointer' : 'hover:bg-muted cursor-pointer'
                          }`}
                        >
                          <td className="px-3" onClick={(e) => e.stopPropagation()}>
                            {toutAuPanier ? (
                              <Check size={16} strokeWidth={2.25} className="text-accent-deep" aria-label="Déjà au panier" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={bonCoche}
                                ref={(el) => {
                                  if (el) el.indeterminate = nbCoches > 0 && !bonCoche
                                }}
                                onChange={(e) => cocherLignes(lignesLibres.map((l) => l.bon_sortie_ligne_id), e.target.checked)}
                                aria-label={`Sélectionner le bon ${b.numero}`}
                                className="accent-[var(--accent)] w-4 h-4 align-middle"
                              />
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => basculerDeplie(b.id)}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-muted"
                              title={deplie ? 'Replier' : 'Voir les lignes'}
                              aria-expanded={deplie}
                            >
                              <ChevronRight size={15} strokeWidth={1.75} className={`transition-transform ${deplie ? 'rotate-90' : ''}`} />
                            </button>
                          </td>
                          <td className="px-3 font-mono text-xs text-info-deep">{b.numero}</td>
                          <td className="px-3 text-text-muted">{dateCourte(b.date)}</td>
                          <td className="px-3 text-text">{b.recuPar ?? '—'}</td>
                          <td className="px-3 text-text-muted truncate max-w-[220px]">{b.motif ?? '—'}</td>
                          <td className="px-3 text-right text-text-muted">{b.lignes.length}</td>
                          <td className="px-3 text-right font-semibold text-text">{reste}</td>
                        </tr>
                        {deplie &&
                          b.lignes.map((l) => {
                            const auPanier = dansPanier.has(l.bon_sortie_ligne_id)
                            const coche = coches.has(l.bon_sortie_ligne_id)
                            return (
                              <tr
                                key={l.bon_sortie_ligne_id}
                                onClick={() => !auPanier && cocherLignes([l.bon_sortie_ligne_id], !coche)}
                                className={`h-9 border-t border-border/60 text-[12.5px] ${
                                  auPanier ? 'bg-muted/40' : coche ? 'bg-accent-soft/40 cursor-pointer' : 'hover:bg-muted/60 cursor-pointer'
                                }`}
                              >
                                <td />
                                <td className="px-1" onClick={(e) => e.stopPropagation()}>
                                  {auPanier ? (
                                    <Check size={14} strokeWidth={2.25} className="text-accent-deep" aria-label="Déjà au panier" />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={coche}
                                      onChange={(e) => cocherLignes([l.bon_sortie_ligne_id], e.target.checked)}
                                      aria-label={`Sélectionner ${l.produit_reference}`}
                                      className="accent-[var(--accent)] w-3.5 h-3.5 align-middle"
                                    />
                                  )}
                                </td>
                                <td className="px-3 font-mono text-xs text-text-muted">{l.produit_reference}</td>
                                <td className="px-3 text-text" colSpan={2}>
                                  {l.produit_designation}
                                </td>
                                <td className="px-3 text-text-muted">
                                  {nomDepot(l.entrepot_id)}
                                  {libelleLot(l) && <span className="font-mono text-[11px]"> · {libelleLot(l)}</span>}
                                </td>
                                <td className="px-3 text-right text-text-muted">{l.quantite_sortie}</td>
                                <td className="px-3 text-right font-semibold text-text">{l.quantite_disponible}</td>
                              </tr>
                            )
                          })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2 px-3 py-2 border-t border-border bg-muted/50">
              {coches.size > 0 && (
                <button
                  type="button"
                  onClick={() => setCoches(new Set())}
                  className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-text hover:bg-muted"
                >
                  Tout décocher
                </button>
              )}
              <button type="button" onClick={ajouterAuPanier} disabled={coches.size === 0} className={`${CLASSE_BOUTON_PRIMAIRE} inline-flex items-center gap-1.5`}>
                <Plus size={15} strokeWidth={1.75} /> Ajouter{coches.size > 0 ? ` (${coches.size})` : ''}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Vue « Panier » : sur toute la hauteur. */
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setVue('choix')
                  setTimeout(() => rechercheRef.current?.focus(), 30)
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-text hover:bg-muted"
              >
                <Plus size={14} strokeWidth={1.75} /> Ajouter d'autres sorties
              </button>
              <span className="text-[13px] font-semibold text-text">Panier de réintégration</span>
              <span className="text-xs text-text-muted">
                <span className="font-semibold text-text">{panier.length}</span> ligne(s) · Quantité totale{' '}
                <span className="font-semibold text-text">{quantiteTotale.toLocaleString('fr-FR')}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={viderPanier}
                disabled={panier.length === 0}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
              >
                <Trash2 size={14} strokeWidth={1.75} /> Vider le panier
              </button>
              <button onClick={onValider} disabled={envoi || panier.length === 0} className={CLASSE_BOUTON_PRIMAIRE}>
                {envoi ? 'Validation...' : 'Valider la réintégration'}
              </button>
            </div>
          </div>
          <div ref={panierRef} className="overflow-auto flex-1 defilement-fin">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                  <th className="font-semibold h-9 px-3">N° de bon</th>
                  <th className="font-semibold h-9 px-3">Référence</th>
                  <th className="font-semibold h-9 px-3">Désignation</th>
                  <th className="font-semibold h-9 px-3">Dépôt</th>
                  <th className="font-semibold h-9 px-3">Lot / N° série</th>
                  <th className="font-semibold h-9 px-3 text-right">Sorti</th>
                  <th className="font-semibold h-9 px-3 text-right">Reste</th>
                  <th className="font-semibold h-9 px-3 w-32 text-right">Quantité</th>
                  <th className="font-semibold h-9 px-3">Localisation de retour</th>
                  <th className="h-9 px-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {panier.map((p) => {
                  const erreurQte = erreurQuantite(p)
                  const localisations = emplacements.filter((e) => e.entrepot_id === p.ligne.entrepot_id)
                  return (
                    <tr key={p.cle} className="h-11 border-t border-border">
                      <td className="px-3 font-mono text-xs text-info-deep">{p.ligne.bon_sortie_numero}</td>
                      <td className="px-3 font-mono text-xs text-text-muted">{p.ligne.produit_reference}</td>
                      <td className="px-3 font-medium text-text">{p.ligne.produit_designation}</td>
                      <td className="px-3 text-text-muted">{nomDepot(p.ligne.entrepot_id)}</td>
                      <td className="px-3 font-mono text-xs text-text-muted">{libelleLot(p.ligne)}</td>
                      <td className="px-3 text-right text-text-muted">{p.ligne.quantite_sortie}</td>
                      <td className="px-3 text-right font-semibold text-text">{p.ligne.quantite_disponible}</td>
                      <CaseErreur erreur={erreurQte} className="px-3 py-1">
                        <input
                          type="number"
                          min="1"
                          max={p.ligne.quantite_disponible}
                          data-quantite={p.cle}
                          value={p.quantite}
                          onChange={(e) => majLigne(p.cle, { quantite: e.target.value })}
                          aria-invalid={erreurQte != null}
                          className={`${CLASSE_CHAMP_COMPACT} text-right ${erreurQte ? 'border-danger' : ''}`}
                        />
                      </CaseErreur>
                      <td className="px-3 py-1">
                        <select
                          value={p.emplacementId}
                          onChange={(e) => majLigne(p.cle, { emplacementId: e.target.value })}
                          className={`${CLASSE_CHAMP_COMPACT} max-w-[180px] font-mono text-xs`}
                        >
                          {localisations.map((em) => (
                            <option key={em.id} value={em.id}>
                              {em.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setPanier((prev) => prev.filter((x) => x.cle !== p.cle))}
                          className="text-text-muted hover:text-danger"
                          title="Retirer du panier"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {panier.length === 0 && <p className="text-sm text-text-muted py-10 text-center">Panier vide</p>}
          </div>
        </div>
      )}
    </div>
  )
}

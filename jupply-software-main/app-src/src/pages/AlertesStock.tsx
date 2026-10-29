import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Filter, ShieldAlert } from 'lucide-react'
import { useTabs } from '../context/TabsContext'
import { useSelection } from '../context/SelectionContext'
import { texteFiltre } from '../lib/filtreTexte'
import { getProduitsAvecStock, stockAlerte } from '../lib/api/stock'
import { getCommandesProduits, getLocalisationsProduits } from '../lib/api/produits'
import { compterDossiersOuverts } from '../lib/api/quarantaine'
import { getCommandesEnCoursParProduit, type CommandeEnCoursProduit } from '../lib/api/commandes'
import { getDerniersPassagesAlerte, type PassagesAlerte } from '../lib/api/suiviStock'
import type { LocalisationProduit, ProduitAvecStock, StatutStock } from '../types/stock'
import { useMenuContextuel } from '../components/ui/MenuContextuel'
import { StatutBadge } from '../components/dashboard/StatutBadge'
import { ChampRecherche } from '../components/ui/ChampRecherche'
import { CaseFiltre, PanneauFiltres, SectionFiltre } from '../components/ui/PanneauFiltres'
import { CLASSE_LIGNE_INFO, ItemInfoPopover, useItemInfo } from '../components/ui/ItemInfo'
import { AlerteInfoPanel } from '../components/alertes/AlerteInfoPanel'

/** Filtres du panneau latéral. Les catégories sont mémorisées en exclusion : une nouvelle catégorie reste visible. */
interface FiltresPanneau {
  statuts: StatutStock[]
  /** 'oui' = quantité commandée pas encore reçue (colonne Commandé), 'non' = rien de commandé. */
  commande: ('oui' | 'non')[]
  categoriesExclues: string[]
}

const PANNEAU_DEFAUT: FiltresPanneau = { statuts: ['rupture', 'faible'], commande: ['oui', 'non'], categoriesExclues: [] }

const SANS_CATEGORIE = 'Sans catégorie'

function basculerValeur<T>(liste: T[], valeur: T, coche: boolean): T[] {
  return coche ? (liste.includes(valeur) ? liste : [...liste, valeur]) : liste.filter((v) => v !== valeur)
}

interface Filtres {
  reference: string
  designation: string
  categorie: string
}

type ColonneFiltrable = keyof Filtres

const FILTRES_VIDES: Filtres = { reference: '', designation: '', categorie: '' }

const LIBELLES_COLONNE: Record<ColonneFiltrable, string> = {
  reference: 'Référence',
  designation: 'Désignation',
  categorie: 'Catégorie',
}

function correspond(produit: ProduitAvecStock, filtres: Filtres): boolean {
  return (
    texteFiltre(produit.reference, filtres.reference) &&
    texteFiltre(produit.designation, filtres.designation) &&
    texteFiltre(produit.categorie_nom ?? '', filtres.categorie)
  )
}

/** Écart entre le stock disponible et le stock d'alerte (négatif ou nul pour un produit en alerte). */
function ecart(produit: ProduitAvecStock): number {
  return produit.stock_actuel - stockAlerte(produit)
}

function resumeLocalisation(lignes: LocalisationProduit[] | undefined): string {
  if (!lignes || lignes.length === 0) return '—'
  return [...new Set(lignes.map((l) => l.emplacement_code))].join(', ')
}

/** Case au-dessus de l'en-tête, façon AIRSTOCK : affiche le filtre en cours de saisie pour la colonne active. */
function IndicateurFiltre({
  colonne,
  actif,
  valeur,
}: {
  colonne: ColonneFiltrable
  actif: ColonneFiltrable | null
  valeur: string
}) {
  return (
    <th className="px-2 py-0.5 text-left">
      {(actif === colonne || valeur) && (
        <span className="inline-block min-w-[50px] bg-accent-soft border border-accent rounded px-1.5 py-0.5 text-[11px] font-medium text-accent-deep">
          {valeur || LIBELLES_COLONNE[colonne]}
        </span>
      )}
    </th>
  )
}

export function AlertesStock() {
  const { ongletActifId, ouvrirOnglet } = useTabs()
  const { demanderAffichageProduit } = useSelection()
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [commandes, setCommandes] = useState<Map<string, number>>(new Map())
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [panneau, setPanneau] = useState<FiltresPanneau>(PANNEAU_DEFAUT)
  // Filtres en cours de modification dans le panneau (null = panneau fermé).
  const [brouillon, setBrouillon] = useState<FiltresPanneau | null>(null)
  const [commandesEnCours, setCommandesEnCours] = useState<Map<string, CommandeEnCoursProduit[]>>(new Map())
  const [passages, setPassages] = useState<Map<string, PassagesAlerte>>(new Map())
  const [journalDisponible, setJournalDisponible] = useState(true)
  const info = useItemInfo<ProduitAvecStock>()
  const [recherche, setRecherche] = useState('')
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES)
  const [colonneActive, setColonneActive] = useState<ColonneFiltrable | null>(null)
  const [selectionId, setSelectionId] = useState<string | null>(null)

  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()
  const estActif = ongletActifId === 'alertes'
  const [quarantaine, setQuarantaine] = useState<{ dossiers: number; unites: number } | null>(null)

  function charger() {
    compterDossiersOuverts().then(setQuarantaine)
    // Commandes en cours : si la migration des commandes n'est pas passée, l'écran reste utilisable sans.
    getCommandesEnCoursParProduit()
      .then(setCommandesEnCours)
      .catch(() => setCommandesEnCours(new Map()))
    Promise.all([getProduitsAvecStock(), getCommandesProduits(), getLocalisationsProduits()])
      .then(([p, cmd, loc]) => {
        setProduits(p)
        setCommandes(cmd)
        setLocalisations(loc)
        setErreur(null)
        return getDerniersPassagesAlerte(p.filter((x) => x.statut !== 'normal').map((x) => x.id))
          .then((pa) => {
            setPassages(pa)
            setJournalDisponible(true)
          })
          .catch(() => setJournalDisponible(false))
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  // Les onglets restent montés en arrière-plan : on recharge à chaque retour
  // sur celui-ci, pour refléter les entrées/sorties faites entre-temps.
  useEffect(() => {
    if (estActif) charger()
  }, [estActif])

  // Filtre "à la AIRSTOCK", comme dans Produits : cliquer une cellule active
  // sa colonne, puis taper au clavier remplit le filtre de cette colonne.
  useEffect(() => {
    if (!colonneActive || !estActif) return

    function onKeyDown(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null
      const editeCible = cible?.tagName === 'INPUT' || cible?.tagName === 'TEXTAREA' || cible?.tagName === 'SELECT'
      if (editeCible || !colonneActive) return

      if (e.key === 'Escape') {
        setFiltres((f) => ({ ...f, [colonneActive]: '' }))
        setColonneActive(null)
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        setFiltres((f) => ({ ...f, [colonneActive]: f[colonneActive].slice(0, -1) }))
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setFiltres((f) => ({ ...f, [colonneActive]: f[colonneActive] + e.key }))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [colonneActive, estActif])

  // Ruptures d'abord, puis du plus gros écart au plus petit.
  const alertes = useMemo(
    () =>
      produits
        .filter((p) => p.statut !== 'normal')
        .sort((a, b) => {
          if (a.statut !== b.statut) return a.statut === 'rupture' ? -1 : 1
          return ecart(a) - ecart(b) || a.designation.localeCompare(b.designation)
        }),
    [produits],
  )
  const estCommande = (p: ProduitAvecStock) => (commandes.get(p.id) ?? 0) > 0
  const categorieDe = (p: ProduitAvecStock) => p.categorie_nom ?? SANS_CATEGORIE
  const categories = useMemo(() => [...new Set(alertes.map(categorieDe))].sort((a, b) => a.localeCompare(b)), [alertes])
  const compter = (test: (p: ProduitAvecStock) => boolean) => alertes.filter(test).length
  const lignes = useMemo(
    () =>
      alertes.filter(
        (p) =>
          panneau.statuts.includes(p.statut) &&
          panneau.commande.includes((commandes.get(p.id) ?? 0) > 0 ? 'oui' : 'non') &&
          !panneau.categoriesExclues.includes(p.categorie_nom ?? SANS_CATEGORIE) &&
          correspond(p, filtres) &&
          (!recherche.trim() || texteFiltre(p.reference, recherche) || texteFiltre(p.designation, recherche)),
      ),
    [alertes, panneau, commandes, filtres, recherche],
  )

  // Rappel des filtres actifs à côté du bouton Filtre.
  const partiesFiltre = [
    panneau.statuts.length === 1 ? (panneau.statuts[0] === 'rupture' ? 'Rupture' : 'En alerte') : panneau.statuts.length === 0 ? 'aucun statut' : null,
    panneau.commande.length === 1 ? (panneau.commande[0] === 'oui' ? 'Commandé' : 'Non commandé') : panneau.commande.length === 0 ? 'aucune commande' : null,
    panneau.categoriesExclues.some((c) => categories.includes(c))
      ? `${categories.filter((c) => !panneau.categoriesExclues.includes(c)).length} catégorie(s) sur ${categories.length}`
      : null,
  ].filter((x): x is string => x != null)

  function voirDansProduits(produit: ProduitAvecStock) {
    demanderAffichageProduit(produit.id)
    ouvrirOnglet('produits', 'Produits')
  }

  function onClicDroitLigne(e: MouseEvent, produit: ProduitAvecStock) {
    info.fermer()
    setSelectionId(produit.id)
    ouvrirMenu(e, [{ label: 'Voir dans Produits', onClick: () => voirDansProduits(produit) }])
  }

  /** Clic sur une ligne (ou une cellule filtrable) : sélection, colonne de filtre éventuelle, bulle « Info ». */
  function cliquerLigne(e: MouseEvent<HTMLElement>, produit: ProduitAvecStock, colonne?: ColonneFiltrable) {
    setSelectionId(produit.id)
    if (colonne) setColonneActive(colonne)
    info.ouvrirBulle(e, produit)
  }

  function celluleFiltrable(colonne: ColonneFiltrable, produit: ProduitAvecStock) {
    return (e: MouseEvent<HTMLElement>) => {
      e.stopPropagation()
      cliquerLigne(e, produit, colonne)
    }
  }

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2">
      <div className="shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="shrink-0 text-[length:var(--page-title-size)] font-semibold text-text leading-tight">
            Alertes stock <span className="ml-1 font-normal text-text-muted tabular-nums">[{lignes.length}]</span>
          </h1>
          <ChampRecherche valeur={recherche} onChange={setRecherche} aide="Code ou nom du produit (* en tête = contient)" />
        </div>
        <div className="shrink-0 flex items-center gap-2">
        {partiesFiltre.length > 0 && (
          <span className="text-[11.5px] text-text-muted truncate max-w-[240px]" title={partiesFiltre.join(' · ')}>
            {partiesFiltre.join(' · ')}
          </span>
        )}
        <button
          type="button"
          onClick={() => setBrouillon(panneau)}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors ${
            partiesFiltre.length > 0 ? 'bg-accent-soft border-accent/50 text-accent-deep' : 'bg-card border-border text-text hover:bg-muted'
          }`}
        >
          <Filter size={14} strokeWidth={1.75} /> Filtre
          {partiesFiltre.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-4 h-4 rounded-full bg-accent text-accent-contrast text-[10px] font-bold px-1">
              {partiesFiltre.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => ouvrirOnglet('quarantaine', 'Quarantaine')}
          title="Produits non conformes bloqués en quarantaine, et leur traitement"
          className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-text text-xs font-semibold rounded-lg px-3 h-8 transition-colors"
        >
          <ShieldAlert size={14} strokeWidth={1.75} className="text-danger-deep" />
          Quarantaine
          {quarantaine && quarantaine.dossiers > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-danger-soft text-danger-deep text-[11px] font-bold px-1.5">
              {quarantaine.dossiers}
            </span>
          )}
        </button>
        </div>
      </div>

      {erreur && (
        <div className="shrink-0 bg-danger-soft text-danger-deep text-sm rounded-lg px-3 py-2">
          Impossible de charger les alertes : {erreur}
        </div>
      )}

      {chargement ? (
        <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
      ) : (
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="tableau-dense tableau-ajuste">
              {/* En pourcentages : la Désignation garde un quart de la largeur quel que soit l'écran ou le zoom. */}
              <colgroup>
                <col style={{ width: '9%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-card">
                  <IndicateurFiltre colonne="reference" actif={colonneActive} valeur={filtres.reference} />
                  <IndicateurFiltre colonne="designation" actif={colonneActive} valeur={filtres.designation} />
                  <IndicateurFiltre colonne="categorie" actif={colonneActive} valeur={filtres.categorie} />
                  <th colSpan={7} />
                </tr>
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                  <th className="font-semibold h-8 px-2">Référence</th>
                  <th className="font-semibold h-8 px-2">Désignation</th>
                  <th className="font-semibold h-8 px-2">Catégorie</th>
                  <th className="font-semibold h-8 px-2 text-right">Stock</th>
                  <th className="font-semibold h-8 px-2 text-right">Stock d'alerte</th>
                  <th className="font-semibold h-8 px-2 text-right">Écart</th>
                  <th className="font-semibold h-8 px-2 text-right">Stock min</th>
                  <th className="font-semibold h-8 px-2 text-right" title="Quantité commandée au fournisseur et pas encore reçue">Commandé</th>                  <th className="font-semibold h-8 px-2">Statut</th>
                  <th className="font-semibold h-8 px-2">Localisation</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((p) => {
                  const enCommande = commandes.get(p.id) ?? 0
                  return (
                    <tr
                      key={p.id}
                      onClick={(e) => cliquerLigne(e, p)}
                      onDoubleClick={() => {
                        info.fermer()
                        voirDansProduits(p)
                      }}
                      onContextMenu={(e) => onClicDroitLigne(e, p)}
                      className={`h-9 border-t border-border cursor-pointer ${
                        selectionId === p.id ? 'bg-accent-soft' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      } ${info.element?.id === p.id ? CLASSE_LIGNE_INFO : ''}`}
                    >
                      <td className="px-2 font-mono text-xs text-text-muted" onClick={celluleFiltrable('reference', p)}>
                        {p.reference}
                      </td>
                      <td className="px-2 font-medium text-text" onClick={celluleFiltrable('designation', p)}>
                        {p.designation}
                      </td>
                      <td className="px-2 text-text-muted" onClick={celluleFiltrable('categorie', p)}>
                        {p.categorie_nom ?? '—'}
                      </td>
                      <td className="px-2 text-right font-semibold text-text">{p.stock_actuel}</td>
                      <td className="px-2 text-right text-text">{stockAlerte(p)}</td>
                      <td
                        className={`px-2 text-right font-semibold ${
                          p.statut === 'rupture' ? 'text-danger-deep' : 'text-warn-deep'
                        }`}
                      >
                        {ecart(p)}
                      </td>
                      <td className="px-2 text-right text-text-muted">{p.stock_min}</td>
                      <td className={`px-2 text-right ${enCommande > 0 ? 'text-accent-deep font-semibold' : 'text-text-muted'}`}>
                        {enCommande}
                      </td>                      <td className="px-2">
                        <StatutBadge statut={p.statut} />
                      </td>
                      <td className="px-2 text-text-muted font-mono text-xs">{resumeLocalisation(localisations.get(p.id))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {lignes.length === 0 && (
              <p className="text-sm text-text-muted py-8 text-center">
                {alertes.length === 0
                  ? 'Aucune alerte, tous les produits sont au-dessus de leur stock d\'alerte.'
                  : 'Aucun produit en alerte ne correspond aux filtres.'}
              </p>
            )}
          </div>
        </div>
      )}

      {menu}

      {brouillon && (
        <PanneauFiltres
          onFermer={() => setBrouillon(null)}
          onReinitialiser={() => setBrouillon(PANNEAU_DEFAUT)}
          onAppliquer={() => {
            setPanneau(brouillon)
            setBrouillon(null)
          }}
        >
          <SectionFiltre
            titre="Statut"
            resume={brouillon.statuts.length === 2 ? 'Tous' : brouillon.statuts.length === 0 ? 'Aucun' : 'Un sur deux'}
            ouvertParDefaut
          >
            <CaseFiltre
              libelle={<>Rupture <span className="text-text-muted">({compter((p) => p.statut === 'rupture')})</span></>}
              coche={brouillon.statuts.includes('rupture')}
              onChange={(c) => setBrouillon({ ...brouillon, statuts: basculerValeur(brouillon.statuts, 'rupture', c) })}
            />
            <CaseFiltre
              libelle={<>En alerte <span className="text-text-muted">({compter((p) => p.statut === 'faible')})</span></>}
              coche={brouillon.statuts.includes('faible')}
              onChange={(c) => setBrouillon({ ...brouillon, statuts: basculerValeur(brouillon.statuts, 'faible', c) })}
            />
          </SectionFiltre>
          <SectionFiltre
            titre="Commande"
            resume={brouillon.commande.length === 2 ? 'Tous' : brouillon.commande.length === 0 ? 'Aucun' : brouillon.commande[0] === 'oui' ? 'Commandé' : 'Non commandé'}
            ouvertParDefaut
          >
            <p className="text-[11.5px] text-text-muted">Selon la colonne « Commandé » : quantité commandée et pas encore reçue.</p>
            <CaseFiltre
              libelle={<>Commandé <span className="text-text-muted">({compter(estCommande)})</span></>}
              coche={brouillon.commande.includes('oui')}
              onChange={(c) => setBrouillon({ ...brouillon, commande: basculerValeur(brouillon.commande, 'oui', c) })}
            />
            <CaseFiltre
              libelle={<>Non commandé <span className="text-text-muted">({compter((p) => !estCommande(p))})</span></>}
              coche={brouillon.commande.includes('non')}
              onChange={(c) => setBrouillon({ ...brouillon, commande: basculerValeur(brouillon.commande, 'non', c) })}
            />
          </SectionFiltre>
          <SectionFiltre
            titre="Catégorie"
            resume={
              categories.every((c) => !brouillon.categoriesExclues.includes(c))
                ? 'Toutes'
                : `${categories.filter((c) => !brouillon.categoriesExclues.includes(c)).length} sur ${categories.length}`
            }
          >
            <CaseFiltre
              libelle={<span className="font-medium">Toutes les catégories</span>}
              coche={categories.every((c) => !brouillon.categoriesExclues.includes(c))}
              onChange={(c) => setBrouillon({ ...brouillon, categoriesExclues: c ? [] : categories })}
            />
            {categories.map((cat) => (
              <CaseFiltre
                key={cat}
                libelle={<>{cat} <span className="text-text-muted">({compter((p) => categorieDe(p) === cat)})</span></>}
                coche={!brouillon.categoriesExclues.includes(cat)}
                onChange={(c) => setBrouillon({ ...brouillon, categoriesExclues: basculerValeur(brouillon.categoriesExclues, cat, !c) })}
              />
            ))}
          </SectionFiltre>
        </PanneauFiltres>
      )}

      {info.bulleOuverte && info.ligne && (
        <ItemInfoPopover ligne={info.ligne} x={info.x} onInfo={info.afficherPanneau} onFermer={info.fermer} />
      )}
      {info.panneauOuvert && info.element && (
        <AlerteInfoPanel
          produit={produits.find((p) => p.id === info.element?.id) ?? info.element}
          commandes={commandesEnCours.get(info.element.id) ?? []}
          passages={passages.get(info.element.id)}
          journalDisponible={journalDisponible}
          onFermer={info.fermer}
          elementRetour={info.ligne}
        />
      )}
    </div>
  )
}

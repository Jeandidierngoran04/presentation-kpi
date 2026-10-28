import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTabs } from '../context/TabsContext'
import { useSelection } from '../context/SelectionContext'
import { messageErreur } from '../lib/erreurs'
import { peutGererCatalogue, peutSupprimerProduit } from '../lib/permissions'
import { texteFiltre } from '../lib/filtreTexte'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { affecterLocalisation, deplacerStock } from '../lib/api/localisation'
import {
  creerCategorie,
  creerFournisseur,
  creerProduit,
  delierEquivalent,
  getCategories,
  getCommandesProduits,
  getEquivalents,
  getFournisseurs,
  getFournisseursProduit,
  getLocalisationsProduits,
  getToutesLesEquivalences,
  lierEquivalent,
  supprimerProduit,
} from '../lib/api/produits'
import type {
  Categorie,
  Emplacement,
  Entrepot,
  Fournisseur,
  LocalisationProduit,
  ProduitAvecStock,
  ProduitEquivalent,
  StatutStock,
  TypeProduit,
} from '../types/stock'
import { Modal } from '../components/ui/Modal'
import { useMenuContextuel, type ElementMenuContextuel } from '../components/ui/MenuContextuel'
import { StatutBadge } from '../components/dashboard/StatutBadge'
import { CLASSE_LIGNE_INFO, ItemInfoPopover, useItemInfo } from '../components/ui/ItemInfo'
import { ProduitInfoPanel } from '../components/produits/ProduitInfoPanel'
import { ChampRecherche } from '../components/ui/ChampRecherche'

const CLASSE_INPUT = 'border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
const CLASSE_BOUTON_PRIMAIRE =
  'bg-accent hover:bg-accent-strong text-accent-contrast text-sm font-semibold rounded-lg py-2.5 transition-colors disabled:opacity-60'
const LABEL_TYPE: Record<TypeProduit, string> = {
  consommable: 'Consommable',
  outillage: 'Outillage',
  rotable: 'Rotable',
}
const LABEL_STATUT: Record<StatutStock, string> = {
  normal: 'Normal',
  faible: 'En alerte',
  rupture: 'Rupture',
}

interface Filtres {
  reference: string
  designation: string
  categorie: string
  type: string
  statut: string
  localisation: string
}

type ColonneFiltrable = keyof Filtres

const FILTRES_VIDES: Filtres = {
  reference: '',
  designation: '',
  categorie: '',
  type: '',
  statut: '',
  localisation: '',
}

function correspond(produit: ProduitAvecStock, filtres: Filtres, localisationTexte: string): boolean {
  return (
    texteFiltre(produit.reference, filtres.reference) &&
    texteFiltre(produit.designation, filtres.designation) &&
    texteFiltre(produit.categorie_nom ?? '', filtres.categorie) &&
    texteFiltre(LABEL_TYPE[produit.type], filtres.type) &&
    texteFiltre(LABEL_STATUT[produit.statut], filtres.statut) &&
    texteFiltre(localisationTexte, filtres.localisation)
  )
}

/** Localisation exacte (codes d'emplacement), pas juste le nom de l'entrepôt. */
function resumeLocalisation(lignes: LocalisationProduit[] | undefined): string {
  if (!lignes || lignes.length === 0) return '—'
  const codes = [...new Set(lignes.map((l) => l.emplacement_code))]
  return codes.join(', ')
}

const LIBELLES_COLONNE: Record<ColonneFiltrable, string> = {
  reference: 'Référence',
  designation: 'Désignation',
  categorie: 'Catégorie',
  type: 'Type',
  statut: 'Statut',
  localisation: 'Localisation',
}

/** Case au-dessus de l'en-tête, façon AIRSTOCK : vide sauf pour la colonne active, où elle affiche le filtre en cours de saisie. */
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
    <th className="px-2 py-0.5">
      {actif === colonne && (
        <span className="inline-block min-w-[50px] bg-accent-soft border border-accent rounded px-1.5 py-0.5 text-[11px] font-medium text-accent-deep">
          {valeur || LIBELLES_COLONNE[colonne]}
        </span>
      )}
    </th>
  )
}

export function Produits() {
  const { profil } = useAuth()
  const { ongletActifId, ouvrirOnglet } = useTabs()
  const { definirProduitSelectionne, demandeAffichageProduit, demanderFicheStock } = useSelection()
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [categories, setCategories] = useState<Categorie[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [commandes, setCommandes] = useState<Map<string, number>>(new Map())
  const [equivalences, setEquivalences] = useState<Map<string, string[]>>(new Map())
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES)
  const [recherche, setRecherche] = useState('')
  const [colonneActive, setColonneActive] = useState<ColonneFiltrable | null>(null)
  const [modalOuvert, setModalOuvert] = useState(false)
  const [popupEquivalentsId, setPopupEquivalentsId] = useState<string | null>(null)
  const [modalAffecterId, setModalAffecterId] = useState<string | null>(null)
  const [modalDeplacerId, setModalDeplacerId] = useState<string | null>(null)
  const [ficheOuverte, setFicheOuverte] = useState(false)

  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [fournisseursProduit, setFournisseursProduit] = useState<Fournisseur[]>([])
  const [equivalents, setEquivalents] = useState<ProduitEquivalent[]>([])
  const [rechercheEquivalent, setRechercheEquivalent] = useState('')

  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()
  // Bulle « Info » puis fenêtre d'informations de la ligne cliquée.
  const info = useItemInfo<ProduitAvecStock>()

  function chargerListe() {
    Promise.all([
      getProduitsAvecStock(),
      getCategories(),
      getFournisseurs(),
      getLocalisationsProduits(),
      getCommandesProduits(),
      getToutesLesEquivalences(),
    ])
      .then(([p, c, f, l, cmd, eq]) => {
        setProduits(p)
        setCategories(c)
        setFournisseurs(f)
        setLocalisations(l)
        setCommandes(cmd)
        setEquivalences(eq)
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  // Les onglets restent montés en arrière-plan : on recharge à chaque retour
  // sur celui-ci, pour refléter les entrées/sorties faites dans un autre onglet.
  useEffect(() => {
    if (ongletActifId !== 'produits') return
    chargerListe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ongletActifId])

  useEffect(() => {
    if (!selectionId) return
    getFournisseursProduit(selectionId).then(setFournisseursProduit)
    getEquivalents(selectionId).then(setEquivalents)
  }, [selectionId])

  // Reagit a "Voir dans Produits" (ecran Alertes stock) : retire les filtres
  // pour que le produit soit visible, le selectionne et l'amene a l'ecran.
  useEffect(() => {
    if (!demandeAffichageProduit) return
    const { produitId } = demandeAffichageProduit
    setFiltres(FILTRES_VIDES)
    setColonneActive(null)
    setSelectionId(produitId)
    definirProduitSelectionne(produitId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeAffichageProduit])

  useEffect(() => {
    if (!demandeAffichageProduit || chargement) return
    document
      .querySelector(`[data-produit-id="${demandeAffichageProduit.produitId}"]`)
      ?.scrollIntoView({ block: 'center' })
  }, [demandeAffichageProduit, chargement])

  // Filtre "à la AIRSTOCK" : cliquer une cellule active sa colonne, puis
  // taper au clavier (sans avoir besoin de cliquer dans une case de saisie)
  // remplit le filtre affiché au-dessus de l'en-tête de cette colonne.
  const unModalEstOuvert =
    modalOuvert || popupEquivalentsId != null || modalAffecterId != null || modalDeplacerId != null || ficheOuverte || info.panneauOuvert

  useEffect(() => {
    if (!colonneActive || ongletActifId !== 'produits' || unModalEstOuvert) return

    function onKeyDown(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null
      const editeCible = cible?.tagName === 'INPUT' || cible?.tagName === 'TEXTAREA' || cible?.tagName === 'SELECT'
      if (editeCible) return
      if (!colonneActive) return

      if (e.key === 'Escape') {
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
  }, [colonneActive, ongletActifId, unModalEstOuvert])

  // Le tableau se refiltre (saisie au clavier, recherche) : la ligne bouge, la bulle se referme.
  const { bulleOuverte, fermer: fermerInfo } = info
  useEffect(() => {
    if (bulleOuverte) fermerInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtres, recherche])

  // Recherche : code ou nom du produit ("commence par", * en tête = "contient").
  const produitsFiltres = useMemo(
    () =>
      produits.filter(
        (p) =>
          (!recherche.trim() || texteFiltre(p.reference, recherche) || texteFiltre(p.designation, recherche)) &&
          correspond(p, filtres, resumeLocalisation(localisations.get(p.id))),
      ),
    [produits, filtres, localisations, recherche],
  )
  const selection = produits.find((p) => p.id === selectionId) ?? null
  function equivalentsDe(produitId: string): ProduitAvecStock[] {
    const ids = equivalences.get(produitId) ?? []
    return ids.map((id) => produits.find((p) => p.id === id)).filter((p): p is ProduitAvecStock => p != null)
  }

  const produitPopup = popupEquivalentsId ? produits.find((p) => p.id === popupEquivalentsId) : null

  async function onLierEquivalent() {
    if (!selectionId || !rechercheEquivalent.trim()) return
    const cible = produits.find((p) => p.reference.toLowerCase() === rechercheEquivalent.trim().toLowerCase())
    if (!cible || cible.id === selectionId) return
    await lierEquivalent(selectionId, cible.id)
    setRechercheEquivalent('')
    getEquivalents(selectionId).then(setEquivalents)
  }

  async function onDelierEquivalent(autreId: string) {
    if (!selectionId) return
    await delierEquivalent(selectionId, autreId)
    getEquivalents(selectionId).then(setEquivalents)
  }

  async function onSupprimer(produitId: string) {
    if (!confirm('Supprimer définitivement cette référence ?')) return
    await supprimerProduit(produitId)
    if (selectionId === produitId) setSelectionId(null)
    chargerListe()
  }

  function onClicDroitTableau(e: MouseEvent) {
    if (!peutGererCatalogue(profil?.role)) return
    ouvrirMenu(e, [{ label: 'Nouvelle référence', onClick: () => setModalOuvert(true) }])
  }

  function onClicDroitLigne(e: MouseEvent, produit: ProduitAvecStock) {
    e.stopPropagation()
    const elements: ElementMenuContextuel[] = []
    if (peutGererCatalogue(profil?.role)) {
      elements.push({ label: 'Nouvelle référence', onClick: () => setModalOuvert(true) })
    }
    elements.push({
      label: 'Voir la fiche référence',
      onClick: () => {
        setSelectionId(produit.id)
        setFicheOuverte(true)
      },
    })
    elements.push({ label: 'Affecter une localisation', onClick: () => setModalAffecterId(produit.id) })
    if ((localisations.get(produit.id) ?? []).length > 0) {
      elements.push({ label: 'Modifier la localisation', onClick: () => setModalDeplacerId(produit.id) })
    }
    if (peutSupprimerProduit(profil?.role)) {
      elements.push({ label: 'Supprimer cette référence', onClick: () => onSupprimer(produit.id), dangereux: true })
    }
    if (elements.length === 0) return
    ouvrirMenu(e, elements)
  }

  function apresChangementLocalisation() {
    chargerListe()
  }

  /** Clic sur une ligne (ou une cellule) : sélection, colonne de filtre éventuelle, bulle « Info ». */
  function cliquerLigne(e: MouseEvent<HTMLElement>, produit: ProduitAvecStock, colonne?: ColonneFiltrable) {
    setSelectionId(produit.id)
    definirProduitSelectionne(produit.id)
    if (colonne) setColonneActive(colonne)
    info.ouvrirBulle(e, produit)
  }

  if (erreur) {
    return <div className="max-w-lg mx-auto mt-12 bg-danger-soft text-danger-deep text-sm rounded-xl p-5">{erreur}</div>
  }

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)]" onContextMenu={onClicDroitTableau}>
      {/* Ligne de recherche : code ou nom, * = "contient" */}
      <div className="shrink-0 flex items-center gap-2 flex-wrap">
        <ChampRecherche valeur={recherche} onChange={setRecherche} aide="Code ou nom du produit. Commence par * pour chercher un texte contenu dans le nom." className="w-[320px]" />
        <span className="text-xs text-text-muted">
          <span className="font-semibold text-text tabular-nums">{produitsFiltres.length}</span> / {produits.length} produit(s)
        </span>
      </div>
      {chargement ? (
        <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
      ) : (
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="tableau-dense tableau-ajuste">
              <colgroup><col style={{ width: '3.5%' }} /><col style={{ width: '11%' }} /><col style={{ width: '25.5%' }} /><col style={{ width: '13%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '9.5%' }} /><col style={{ width: '9.5%' }} /><col style={{ width: '12%' }} /></colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-card">
                  <th className="px-2 py-0.5" />
                  <IndicateurFiltre colonne="reference" actif={colonneActive} valeur={filtres.reference} />
                  <IndicateurFiltre colonne="designation" actif={colonneActive} valeur={filtres.designation} />
                  <IndicateurFiltre colonne="categorie" actif={colonneActive} valeur={filtres.categorie} />
                  <IndicateurFiltre colonne="type" actif={colonneActive} valeur={filtres.type} />
                  <th className="px-2 py-0.5" />
                  <IndicateurFiltre colonne="statut" actif={colonneActive} valeur={filtres.statut} />
                  <th className="px-2 py-0.5" />
                  <IndicateurFiltre colonne="localisation" actif={colonneActive} valeur={filtres.localisation} />
                </tr>
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                  <th style={{ padding: '0 2px', textAlign: 'center' }} title="Produits équivalents : d'autres références qui peuvent remplacer celle-ci (avec leur stock)">
                    É
                  </th>
                  <th title="Code unique du produit">Référence</th>
                  <th title="Nom du produit">Désignation</th>
                  <th title="Famille de produits">Catégorie</th>
                  <th title="Consommable (s'use), outillage (se prête et revient) ou rotable (se répare)">Type</th>
                  <th title="Quantité disponible, hors quarantaine">Stock</th>
                  <th title="Normal, en alerte (il faut recommander) ou en rupture (plus rien)">Statut</th>
                  <th title="Quantité commandée au fournisseur et pas encore reçue">Commandé</th>
                  <th title="Emplacement(s) où le produit est rangé">Localisation</th>
                </tr>
              </thead>
              <tbody>
                {produitsFiltres.map((p) => {
                  const liesEquivalents = equivalentsDe(p.id)
                  const stockEquivalents = liesEquivalents.reduce((total, e) => total + e.stock_actuel, 0)
                  return (
                    <tr
                      key={p.id}
                      data-produit-id={p.id}
                      tabIndex={-1}
                      onClick={(e) => cliquerLigne(e, p)}
                      onDoubleClick={() => {
                        info.fermer()
                        setSelectionId(p.id)
                        setFicheOuverte(true)
                      }}
                      onContextMenu={(e) => {
                        info.fermer()
                        onClicDroitLigne(e, p)
                      }}
                      className={`border-t border-border cursor-pointer outline-none ${
                        selectionId === p.id ? 'bg-accent-soft' : 'hover:bg-muted'
                      } ${info.element?.id === p.id ? CLASSE_LIGNE_INFO : ''}`}
                    >
                      <td
                        className="py-1 px-2 text-xs text-text-muted"
                        style={{ padding: '0 2px', textAlign: 'center' }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          if (liesEquivalents.length > 0) setPopupEquivalentsId(p.id)
                        }}
                        title={liesEquivalents.length > 0 ? 'Double-clic pour voir les produits équivalents' : undefined}
                      >
                        {liesEquivalents.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-accent-deep font-semibold">
                            É {stockEquivalents}
                          </span>
                        )}
                      </td>
                      <td
                        className="py-1 px-2 font-mono text-xs text-text-muted"
                        onClick={(e) => {
                          e.stopPropagation()
                          cliquerLigne(e, p, 'reference')
                        }}
                      >
                        {p.reference}
                      </td>
                      <td
                        className="py-1 px-2 font-medium text-text"
                        onClick={(e) => {
                          e.stopPropagation()
                          cliquerLigne(e, p, 'designation')
                        }}
                      >
                        {p.designation}
                      </td>
                      <td
                        className="py-1 px-2 text-text-muted"
                        onClick={(e) => {
                          e.stopPropagation()
                          cliquerLigne(e, p, 'categorie')
                        }}
                      >
                        {p.categorie_nom ?? '—'}
                      </td>
                      <td
                        className="py-1 px-2 text-text-muted"
                        onClick={(e) => {
                          e.stopPropagation()
                          cliquerLigne(e, p, 'type')
                        }}
                      >
                        {LABEL_TYPE[p.type]}
                      </td>
                      <td className="py-1 px-2 text-text font-medium">{p.stock_actuel}</td>
                      <td
                        className="py-1 px-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          cliquerLigne(e, p, 'statut')
                        }}
                      >
                        <StatutBadge statut={p.statut} />
                      </td>
                      <td className="py-1 px-2 text-text-muted">{commandes.get(p.id) ?? 0}</td>
                      <td
                        className="py-1 px-2 text-text-muted font-mono text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          cliquerLigne(e, p, 'localisation')
                        }}
                      >
                        {resumeLocalisation(localisations.get(p.id))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {produitsFiltres.length === 0 && (
              <p className="text-sm text-text-muted py-8 text-center">Aucun produit ne correspond aux filtres.</p>
            )}
          </div>
        </div>
      )}

      {info.bulleOuverte && info.ligne && (
        <ItemInfoPopover ligne={info.ligne} x={info.x} onInfo={info.afficherPanneau} onFermer={info.fermer} />
      )}
      {info.panneauOuvert && info.element && (
        <ProduitInfoPanel
          produit={produits.find((p) => p.id === info.element?.id) ?? info.element}
          enCommande={commandes.get(info.element.id) ?? 0}
          localisations={localisations.get(info.element.id) ?? []}
          equivalents={equivalentsDe(info.element.id)}
          onFermer={info.fermer}
          elementRetour={info.ligne}
          onAvance={() => {
            const id = info.element!.id
            info.fermer()
            demanderFicheStock(id)
            ouvrirOnglet('fiche-stock', 'Fiche de stock')
          }}
        />
      )}

      {ficheOuverte && selection && (
        <FicheProduitModal
          produit={selection}
          fournisseurs={fournisseursProduit}
          equivalents={equivalents}
          rechercheEquivalent={rechercheEquivalent}
          onChangerRechercheEquivalent={setRechercheEquivalent}
          onLierEquivalent={onLierEquivalent}
          onDelierEquivalent={onDelierEquivalent}
          peutLier={peutGererCatalogue(profil?.role)}
          onOuvrirProduit={(id) => {
            setSelectionId(id)
          }}
          onFermer={() => setFicheOuverte(false)}
        />
      )}

      {modalOuvert && profil && (
        <NouveauProduitModal
          entrepriseId={profil.entreprise_id}
          categories={categories}
          fournisseurs={fournisseurs}
          onCategorieCreee={(c) => setCategories((prev) => [...prev, c].sort((a, b) => a.nom.localeCompare(b.nom)))}
          onFournisseurCree={(f) => setFournisseurs((prev) => [...prev, f].sort((a, b) => a.nom.localeCompare(b.nom)))}
          onFermer={() => setModalOuvert(false)}
          onCree={() => {
            setModalOuvert(false)
            chargerListe()
          }}
        />
      )}

      {produitPopup && (
        <Modal titre={`Équivalents — ${produitPopup.designation}`} onFermer={() => setPopupEquivalentsId(null)}>
          <ul className="flex flex-col gap-1.5">
            {equivalentsDe(produitPopup.id).map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => {
                    setSelectionId(e.id)
                    setPopupEquivalentsId(null)
                  }}
                  className="w-full flex items-center justify-between text-sm bg-muted hover:bg-accent-soft rounded-lg px-3 py-2 text-left"
                >
                  <span>
                    <span className="font-mono text-xs text-text-muted mr-2">{e.reference}</span>
                    <span className="text-text">{e.designation}</span>
                  </span>
                  <span className="text-text-muted font-medium">{e.stock_actuel}</span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {modalAffecterId &&
        (() => {
          const produit = produits.find((p) => p.id === modalAffecterId)
          if (!produit) return null
          return (
            <AffecterLocalisationModal
              produit={produit}
              onFermer={() => setModalAffecterId(null)}
              onAffecte={() => {
                setModalAffecterId(null)
                apresChangementLocalisation()
              }}
            />
          )
        })()}

      {modalDeplacerId &&
        (() => {
          const produit = produits.find((p) => p.id === modalDeplacerId)
          if (!produit) return null
          return (
            <ModifierLocalisationModal
              produit={produit}
              localisations={localisations.get(produit.id) ?? []}
              onFermer={() => setModalDeplacerId(null)}
              onDeplace={() => {
                setModalDeplacerId(null)
                apresChangementLocalisation()
              }}
            />
          )
        })()}

      {menu}
    </div>
  )
}

interface NouveauProduitModalProps {
  entrepriseId: string
  categories: Categorie[]
  fournisseurs: Fournisseur[]
  onCategorieCreee: (c: Categorie) => void
  onFournisseurCree: (f: Fournisseur) => void
  onFermer: () => void
  onCree: () => void
}

function NouveauProduitModal({
  entrepriseId,
  categories,
  fournisseurs,
  onCategorieCreee,
  onFournisseurCree,
  onFermer,
  onCree,
}: NouveauProduitModalProps) {
  const [categorieId, setCategorieId] = useState('')
  const [nouvelleCategorie, setNouvelleCategorie] = useState('')
  const [fournisseursSelectionnes, setFournisseursSelectionnes] = useState<Set<string>>(new Set())
  const [nouveauFournisseur, setNouveauFournisseur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  function basculerFournisseur(id: string) {
    setFournisseursSelectionnes((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  async function onAjouterCategorie() {
    if (!nouvelleCategorie.trim()) return
    const c = await creerCategorie(entrepriseId, nouvelleCategorie.trim())
    onCategorieCreee(c)
    setCategorieId(c.id)
    setNouvelleCategorie('')
  }

  async function onAjouterFournisseur() {
    if (!nouveauFournisseur.trim()) return
    const f = await creerFournisseur(entrepriseId, nouveauFournisseur.trim())
    onFournisseurCree(f)
    setFournisseursSelectionnes((prev) => new Set(prev).add(f.id))
    setNouveauFournisseur('')
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      const donnees = new FormData(e.currentTarget)
      await creerProduit({
        entrepriseId,
        reference: String(donnees.get('reference')),
        designation: String(donnees.get('designation')),
        categorieId: categorieId || null,
        type: (String(donnees.get('type')) as TypeProduit) || 'consommable',
        uniteMesure: String(donnees.get('unite') || 'piece'),
        prix: Number(donnees.get('prix') || 0),
        stockMin: Number(donnees.get('stock_min') || 0),
        stockMax: donnees.get('stock_max') ? Number(donnees.get('stock_max')) : null,
        seuilReappro: donnees.get('seuil_reappro') ? Number(donnees.get('seuil_reappro')) : null,
        gereLot: donnees.get('gere_lot') === 'on',
        gereNumeroSerie: donnees.get('gere_numero_serie') === 'on',
        gereExpiration: donnees.get('gere_expiration') === 'on',
        fournisseurIds: [...fournisseursSelectionnes],
      })
      onCree()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre="Nouvelle référence" onFermer={onFermer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Référence</span>
            <input name="reference" required className={CLASSE_INPUT} placeholder="ART-0027" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Type</span>
            <select name="type" defaultValue="consommable" className={CLASSE_INPUT}>
              <option value="consommable">Consommable</option>
              <option value="outillage">Outillage</option>
              <option value="rotable">Rotable</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Désignation</span>
          <input name="designation" required className={CLASSE_INPUT} placeholder="Nom du produit" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Catégorie</span>
          <div className="flex gap-1.5">
            <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)} className={`${CLASSE_INPUT} flex-1`}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5">
            <input
              value={nouvelleCategorie}
              onChange={(e) => setNouvelleCategorie(e.target.value)}
              placeholder="+ Nouvelle catégorie"
              className={`${CLASSE_INPUT} flex-1 text-xs py-1.5`}
            />
            <button type="button" onClick={onAjouterCategorie} className="text-xs font-semibold bg-card border border-border rounded-lg px-2.5 hover:border-text-muted">
              Ajouter
            </button>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Unité de mesure</span>
            <input name="unite" defaultValue="piece" className={CLASSE_INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Prix (XOF)</span>
            <input name="prix" type="number" min="0" step="0.01" defaultValue="0" className={CLASSE_INPUT} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Stock min</span>
            <input name="stock_min" type="number" min="0" defaultValue="0" className={CLASSE_INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Stock max</span>
            <input name="stock_max" type="number" min="0" className={CLASSE_INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted" title="Seuil de réapprovisionnement (point de commande)">
              Stock d'alerte
            </span>
            <input name="seuil_reappro" type="number" min="0" className={CLASSE_INPUT} />
          </label>
        </div>

        <div className="flex gap-4 text-xs text-text">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="gere_lot" /> Gère le lot
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="gere_numero_serie" /> Gère le N° série
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="gere_expiration" /> Gère l'expiration
          </label>
        </div>

        <div>
          <span className="text-xs font-medium text-text-muted">Fournisseurs</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1.5">
            {fournisseurs.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => basculerFournisseur(f.id)}
                className={`text-xs rounded-md px-2 py-1 border ${
                  fournisseursSelectionnes.has(f.id)
                    ? 'bg-accent border-accent text-accent-contrast'
                    : 'bg-card border-border text-text hover:border-text-muted'
                }`}
              >
                {f.nom}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={nouveauFournisseur}
              onChange={(e) => setNouveauFournisseur(e.target.value)}
              placeholder="+ Nouveau fournisseur"
              className={`${CLASSE_INPUT} flex-1 text-xs py-1.5`}
            />
            <button type="button" onClick={onAjouterFournisseur} className="text-xs font-semibold bg-card border border-border rounded-lg px-2.5 hover:border-text-muted">
              Ajouter
            </button>
          </div>
        </div>

        {erreur && <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2.5">{erreur}</div>}

        <button type="submit" disabled={envoi} className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
          {envoi ? 'Création...' : "Créer la référence"}
        </button>
      </form>
    </Modal>
  )
}

interface FicheProduitModalProps {
  produit: ProduitAvecStock
  fournisseurs: Fournisseur[]
  equivalents: ProduitEquivalent[]
  rechercheEquivalent: string
  onChangerRechercheEquivalent: (valeur: string) => void
  onLierEquivalent: () => void
  onDelierEquivalent: (autreId: string) => void
  peutLier: boolean
  onOuvrirProduit: (id: string) => void
  onFermer: () => void
}

function FicheProduitModal({
  produit,
  fournisseurs,
  equivalents,
  rechercheEquivalent,
  onChangerRechercheEquivalent,
  onLierEquivalent,
  onDelierEquivalent,
  peutLier,
  onOuvrirProduit,
  onFermer,
}: FicheProduitModalProps) {
  return (
    <Modal titre={`Fiche référence — ${produit.reference}`} onFermer={onFermer}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-base font-semibold text-text">{produit.designation}</div>
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm mt-2">
            <dt className="text-text-muted">Catégorie</dt>
            <dd className="text-text">{produit.categorie_nom ?? '—'}</dd>
            <dt className="text-text-muted">Type</dt>
            <dd className="text-text">{LABEL_TYPE[produit.type]}</dd>
            <dt className="text-text-muted">Unité</dt>
            <dd className="text-text">{produit.unite_mesure}</dd>
            <dt className="text-text-muted">Prix moyen pondéré</dt>
            <dd className="text-text">{produit.prix_moyen_pondere.toLocaleString('fr-FR')} XOF</dd>
            <dt className="text-text-muted">Seuils</dt>
            <dd className="text-text">
              min {produit.stock_min} · max {produit.stock_max ?? '—'} · alerte {produit.seuil_reappro ?? '—'}
            </dd>
          </dl>
        </div>

        <div>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Fournisseurs</div>
          {fournisseurs.length === 0 ? (
            <p className="text-xs text-text-muted">Aucun fournisseur lié.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {fournisseurs.map((f) => (
                <li key={f.id} className="text-xs bg-muted text-text rounded-md px-2 py-1">
                  {f.nom}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Produits équivalents</div>
          {equivalents.length === 0 ? (
            <p className="text-xs text-text-muted mb-2">Aucun produit équivalent lié.</p>
          ) : (
            <ul className="flex flex-col gap-1 mb-2">
              {equivalents.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-xs bg-muted rounded-md px-2 py-1.5">
                  <button
                    onDoubleClick={() => onOuvrirProduit(e.id)}
                    title="Double-clic pour ouvrir ce produit"
                    className="text-text hover:text-accent-deep text-left"
                  >
                    {e.reference} — {e.designation}
                  </button>
                  <button onClick={() => onDelierEquivalent(e.id)} className="text-text-muted hover:text-danger">
                    Délier
                  </button>
                </li>
              ))}
            </ul>
          )}
          {peutLier && (
            <div className="flex gap-1.5">
              <input
                value={rechercheEquivalent}
                onChange={(e) => onChangerRechercheEquivalent(e.target.value)}
                placeholder="Référence exacte à lier"
                className={`${CLASSE_INPUT} flex-1 text-xs py-1.5`}
              />
              <button
                onClick={onLierEquivalent}
                className="text-xs font-semibold bg-card border border-border rounded-lg px-2.5 hover:border-text-muted"
              >
                Lier
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

interface AffecterLocalisationModalProps {
  produit: ProduitAvecStock
  onFermer: () => void
  onAffecte: () => void
}

function AffecterLocalisationModal({ produit, onFermer, onAffecte }: AffecterLocalisationModalProps) {
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [entrepotId, setEntrepotId] = useState('')
  const [emplacementId, setEmplacementId] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    getEntrepots().then((liste) => {
      setEntrepots(liste)
      if (liste.length > 0) setEntrepotId(liste[0].id)
    })
  }, [])

  useEffect(() => {
    if (!entrepotId) return
    setEmplacementId('')
    getEmplacements(entrepotId).then(setEmplacements)
  }, [entrepotId])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!emplacementId) {
      setErreur('Choisis un emplacement.')
      return
    }
    setErreur(null)
    setEnvoi(true)
    try {
      const donnees = new FormData(e.currentTarget)
      await affecterLocalisation({
        produitId: produit.id,
        entrepotId,
        emplacementId,
        quantite: Number(donnees.get('quantite')),
      })
      onAffecte()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre={`Affecter une localisation — ${produit.designation}`} onFermer={onFermer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Entrepôt</span>
          <select value={entrepotId} onChange={(e) => setEntrepotId(e.target.value)} className={CLASSE_INPUT}>
            {entrepots.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Emplacement</span>
          <select value={emplacementId} onChange={(e) => setEmplacementId(e.target.value)} className={CLASSE_INPUT}>
            <option value="">Choisir...</option>
            {emplacements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code}
                {e.est_quarantaine ? ' (Quarantaine)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Quantité</span>
          <input name="quantite" type="number" min="1" required defaultValue="1" className={CLASSE_INPUT} />
        </label>

        {erreur && <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2.5">{erreur}</div>}

        <button type="submit" disabled={envoi} className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
          {envoi ? 'Affectation...' : 'Affecter'}
        </button>
      </form>
    </Modal>
  )
}

interface ModifierLocalisationModalProps {
  produit: ProduitAvecStock
  localisations: LocalisationProduit[]
  onFermer: () => void
  onDeplace: () => void
}

function ModifierLocalisationModal({ produit, localisations, onFermer, onDeplace }: ModifierLocalisationModalProps) {
  const entrepotsAvecStock = useMemo(
    () => [...new Map(localisations.map((l) => [l.entrepot_id, l.entrepot_nom])).entries()],
    [localisations],
  )
  const entrepotInitialId = entrepotsAvecStock[0]?.[0] ?? ''
  const [entrepotId, setEntrepotId] = useState(entrepotInitialId)
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [emplacementSourceId, setEmplacementSourceId] = useState(
    () => localisations.find((l) => l.entrepot_id === entrepotInitialId)?.emplacement_id ?? '',
  )
  const [emplacementDestinationId, setEmplacementDestinationId] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const sourcesDisponibles = localisations.filter((l) => l.entrepot_id === entrepotId)

  useEffect(() => {
    if (!entrepotId) return
    setEmplacementDestinationId('')
    getEmplacements(entrepotId).then(setEmplacements)
  }, [entrepotId])

  function onChangerEntrepot(nouvelEntrepotId: string) {
    setEntrepotId(nouvelEntrepotId)
    const premiereSource = localisations.find((l) => l.entrepot_id === nouvelEntrepotId)
    setEmplacementSourceId(premiereSource?.emplacement_id ?? '')
  }

  const source = sourcesDisponibles.find((l) => l.emplacement_id === emplacementSourceId)
  const destinationsDisponibles = emplacements.filter((e) => e.id !== emplacementSourceId)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!emplacementSourceId || !emplacementDestinationId) {
      setErreur('Choisis un emplacement source et un emplacement destination.')
      return
    }
    setErreur(null)
    setEnvoi(true)
    try {
      const donnees = new FormData(e.currentTarget)
      await deplacerStock({
        produitId: produit.id,
        entrepotId,
        emplacementSourceId,
        emplacementDestinationId,
        quantite: Number(donnees.get('quantite')),
      })
      onDeplace()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre={`Modifier la localisation — ${produit.designation}`} onFermer={onFermer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Entrepôt</span>
          <select value={entrepotId} onChange={(e) => onChangerEntrepot(e.target.value)} className={CLASSE_INPUT}>
            {entrepotsAvecStock.map(([id, nom]) => (
              <option key={id} value={id}>
                {nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Depuis</span>
          <select value={emplacementSourceId} onChange={(e) => setEmplacementSourceId(e.target.value)} className={CLASSE_INPUT}>
            {sourcesDisponibles.map((l) => (
              <option key={l.emplacement_id} value={l.emplacement_id}>
                {l.emplacement_code} ({l.quantite} en stock)
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Vers</span>
          <select
            value={emplacementDestinationId}
            onChange={(e) => setEmplacementDestinationId(e.target.value)}
            className={CLASSE_INPUT}
          >
            <option value="">Choisir...</option>
            {destinationsDisponibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code}
                {e.est_quarantaine ? ' (Quarantaine)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Quantité à déplacer</span>
          <input
            name="quantite"
            type="number"
            min="1"
            max={source?.quantite ?? undefined}
            required
            defaultValue="1"
            className={CLASSE_INPUT}
          />
        </label>

        {erreur && <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2.5">{erreur}</div>}

        <button type="submit" disabled={envoi} className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
          {envoi ? 'Déplacement...' : 'Déplacer'}
        </button>
      </form>
    </Modal>
  )
}

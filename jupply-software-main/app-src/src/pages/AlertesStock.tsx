import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import { useTabs } from '../context/TabsContext'
import { useSelection } from '../context/SelectionContext'
import { texteFiltre } from '../lib/filtreTexte'
import { getProduitsAvecStock, stockAlerte } from '../lib/api/stock'
import { getCommandesProduits, getLocalisationsProduits } from '../lib/api/produits'
import { compterDossiersOuverts } from '../lib/api/quarantaine'
import type { LocalisationProduit, ProduitAvecStock } from '../types/stock'
import { useMenuContextuel } from '../components/ui/MenuContextuel'
import { StatutBadge } from '../components/dashboard/StatutBadge'
import { ChampRecherche } from '../components/ui/ChampRecherche'

type Vue = 'toutes' | 'rupture' | 'faible'

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
  const [actualisation, setActualisation] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [vue, setVue] = useState<Vue>('toutes')
  const [recherche, setRecherche] = useState('')
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES)
  const [colonneActive, setColonneActive] = useState<ColonneFiltrable | null>(null)
  const [selectionId, setSelectionId] = useState<string | null>(null)

  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()
  const estActif = ongletActifId === 'alertes'
  const [quarantaine, setQuarantaine] = useState<{ dossiers: number; unites: number } | null>(null)

  function charger() {
    setActualisation(true)
    compterDossiersOuverts().then(setQuarantaine)
    Promise.all([getProduitsAvecStock(), getCommandesProduits(), getLocalisationsProduits()])
      .then(([p, cmd, loc]) => {
        setProduits(p)
        setCommandes(cmd)
        setLocalisations(loc)
        setErreur(null)
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => {
        setChargement(false)
        setActualisation(false)
      })
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
  const nbRupture = alertes.filter((p) => p.statut === 'rupture').length
  const nbFaible = alertes.length - nbRupture
  const lignes = useMemo(
    () =>
      alertes.filter(
        (p) =>
          (vue === 'toutes' || p.statut === vue) &&
          correspond(p, filtres) &&
          (!recherche.trim() || texteFiltre(p.reference, recherche) || texteFiltre(p.designation, recherche)),
      ),
    [alertes, vue, filtres, recherche],
  )

  function voirDansProduits(produit: ProduitAvecStock) {
    demanderAffichageProduit(produit.id)
    ouvrirOnglet('produits', 'Produits')
  }

  function onClicDroitLigne(e: MouseEvent, produit: ProduitAvecStock) {
    setSelectionId(produit.id)
    ouvrirMenu(e, [{ label: 'Voir dans Produits', onClick: () => voirDansProduits(produit) }])
  }

  function celluleFiltrable(colonne: ColonneFiltrable, produit: ProduitAvecStock) {
    return (e: MouseEvent) => {
      e.stopPropagation()
      setSelectionId(produit.id)
      setColonneActive(colonne)
    }
  }

  const pastilles: { vue: Vue; label: string; nombre: number; classeActive: string }[] = [
    { vue: 'toutes', label: 'Toutes', nombre: alertes.length, classeActive: 'bg-muted border-text-muted text-text' },
    { vue: 'rupture', label: 'Rupture', nombre: nbRupture, classeActive: 'bg-danger-soft border-danger text-danger-deep' },
    { vue: 'faible', label: 'En alerte', nombre: nbFaible, classeActive: 'bg-warn-soft border-warn text-warn-deep' },
  ]

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)]">
      <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[length:var(--page-title-size)] font-semibold text-text leading-tight">
            Alertes stock <span className="ml-1 font-normal text-text-muted tabular-nums">[{lignes.length}]</span>
          </h1>
          <div className="flex items-center gap-1.5">
            {pastilles.map((p) => (
              <button
                key={p.vue}
                onClick={() => setVue(p.vue)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 h-7 text-xs font-semibold transition-colors ${
                  vue === p.vue ? p.classeActive : 'bg-card border-border text-text-muted hover:text-text'
                }`}
              >
                {p.label}
                <span className="font-bold">{p.nombre}</span>
              </button>
            ))}
          </div>
          <ChampRecherche valeur={recherche} onChange={setRecherche} aide="Code ou nom du produit (* en tête = contient)" />
        </div>
        <div className="flex items-center gap-2">
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
        <button
          onClick={charger}
          disabled={actualisation}
          className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-text text-xs font-semibold rounded-lg px-3 h-8 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} strokeWidth={1.75} className={actualisation ? 'animate-spin' : ''} />
          Actualiser
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
              <colgroup><col style={{ width: '10%' }} /><col style={{ width: '22%' }} /><col style={{ width: '12%' }} /><col style={{ width: '7%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '7%' }} /><col style={{ width: '8%' }} /><col style={{ width: '9%' }} /><col style={{ width: '9%' }} /></colgroup>
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
                  <th className="font-semibold h-8 px-2 text-right" title="Quantité commandée au fournisseur et pas encore reçue">Commandé</th>
                  <th className="font-semibold h-8 px-2">Statut</th>
                  <th className="font-semibold h-8 px-2">Localisation</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((p) => {
                  const enCommande = commandes.get(p.id) ?? 0
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectionId(p.id)}
                      onDoubleClick={() => voirDansProduits(p)}
                      onContextMenu={(e) => onClicDroitLigne(e, p)}
                      className={`h-9 border-t border-border cursor-pointer ${
                        selectionId === p.id ? 'bg-accent-soft' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
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
                      </td>
                      <td className="px-2">
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
    </div>
  )
}

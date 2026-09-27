import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { peutReintegrer } from '../lib/permissions'
import { texteFiltre } from '../lib/filtreTexte'
import { dateVersInput, dateSaisieVersISO } from '../lib/dates'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { creerReintegration, getSortiesAReintegrer } from '../lib/api/reintegrations'
import type { Emplacement, Entrepot, SortieAReintegrer } from '../types/stock'

const CLASSE_INPUT = 'border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 h-[26px]'
const CLASSE_CHAMP_LECTURE = 'bg-muted rounded-md px-2 py-1 text-xs text-text h-[26px] flex items-center'
const CLASSE_LABEL = 'text-[9px] font-medium text-text-muted uppercase tracking-wide leading-none'
const CLASSE_BOUTON_PRIMAIRE =
  'bg-accent hover:bg-accent-strong text-accent-contrast text-sm font-semibold rounded-lg py-2.5 px-5 transition-colors disabled:opacity-60'

interface ProduitReintegrable {
  produitId: string
  reference: string
  designation: string
  quantiteDisponible: number
}

interface LignePanierReintegration {
  cle: string
  bonSortieLigneId: string
  reference: string
  designation: string
  emplacementId: string
  emplacementCode: string
  quantite: number
}

export function Reintegration() {
  const { profil, entrepotsAssignes } = useAuth()

  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [entrepotId, setEntrepotId] = useState('')
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [dateDebut, setDateDebut] = useState(() => dateVersInput(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)))
  const [dateFin, setDateFin] = useState(() => dateVersInput(new Date()))
  const [sortiesAReintegrer, setSortiesAReintegrer] = useState<SortieAReintegrer[]>([])

  const [rechercheProduit, setRechercheProduit] = useState('')
  const [produitSelectionneId, setProduitSelectionneId] = useState<string | null>(null)
  const [ligneSelectionnee, setLigneSelectionnee] = useState<SortieAReintegrer | null>(null)
  const [emplacementChoisi, setEmplacementChoisi] = useState('')
  const [quantiteChoisie, setQuantiteChoisie] = useState('1')
  const [panier, setPanier] = useState<LignePanierReintegration[]>([])
  const [panierSelectionneCle, setPanierSelectionneCle] = useState<string | null>(null)
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [notes, setNotes] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [dernierNumero, setDernierNumero] = useState<string | null>(null)

  useEffect(() => {
    getEntrepots().then((liste) => {
      const autorises = liste.filter((e) => peutReintegrer(profil?.role, e.id, entrepotsAssignes))
      setEntrepots(autorises)
      setEntrepotId((prev) => prev || autorises[0]?.id || '')
      setChargement(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function chargerSorties() {
    if (!entrepotId) return
    getSortiesAReintegrer(entrepotId, {
      dateDebut: dateDebut ? `${dateDebut}T00:00:00` : null,
      dateFin: dateFin ? `${dateFin}T23:59:59` : null,
    }).then(setSortiesAReintegrer)
  }

  useEffect(() => {
    chargerSorties()
    getEmplacements(entrepotId).then(setEmplacements)
    setProduitSelectionneId(null)
    setLigneSelectionnee(null)
    setPanier([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrepotId])

  const produitsReintegrables = useMemo<ProduitReintegrable[]>(() => {
    const parProduit = new Map<string, ProduitReintegrable>()
    for (const s of sortiesAReintegrer) {
      const existant = parProduit.get(s.produit_id)
      if (existant) existant.quantiteDisponible += s.quantite_disponible
      else
        parProduit.set(s.produit_id, {
          produitId: s.produit_id,
          reference: s.produit_reference,
          designation: s.produit_designation,
          quantiteDisponible: s.quantite_disponible,
        })
    }
    return [...parProduit.values()]
  }, [sortiesAReintegrer])

  const produitsFiltres = useMemo(
    () => produitsReintegrables.filter((p) => texteFiltre(p.reference, rechercheProduit)),
    [produitsReintegrables, rechercheProduit],
  )

  const lignesDuProduit = useMemo(
    () => sortiesAReintegrer.filter((s) => s.produit_id === produitSelectionneId),
    [sortiesAReintegrer, produitSelectionneId],
  )

  useEffect(() => {
    setEmplacementChoisi(emplacements.find((e) => !e.est_quarantaine)?.id ?? emplacements[0]?.id ?? '')
  }, [ligneSelectionnee, emplacements])

  function onChangerEntrepot(id: string) {
    setEntrepotId(id)
  }

  function onSelectionnerProduit(produitId: string) {
    setProduitSelectionneId(produitId)
    setLigneSelectionnee(null)
  }

  function onAjouterAuPanier() {
    if (!ligneSelectionnee || !emplacementChoisi) return
    const quantite = Number(quantiteChoisie)
    if (!quantite || quantite <= 0) {
      setErreur('Saisis une quantité valide.')
      return
    }
    const dejaEnPanier = panier
      .filter((l) => l.bonSortieLigneId === ligneSelectionnee.bon_sortie_ligne_id)
      .reduce((total, l) => total + l.quantite, 0)
    if (quantite + dejaEnPanier > ligneSelectionnee.quantite_disponible) {
      setErreur('Quantité supérieure au solde disponible pour cette sortie.')
      return
    }
    setErreur(null)
    const emplacement = emplacements.find((e) => e.id === emplacementChoisi)
    setPanier((prev) => [
      ...prev,
      {
        cle: Math.random().toString(36).slice(2),
        bonSortieLigneId: ligneSelectionnee.bon_sortie_ligne_id,
        reference: ligneSelectionnee.produit_reference,
        designation: ligneSelectionnee.produit_designation,
        emplacementId: emplacementChoisi,
        emplacementCode: emplacement?.code ?? '',
        quantite,
      },
    ])
    setLigneSelectionnee(null)
    setQuantiteChoisie('1')
  }

  function onSupprimerDuPanier() {
    if (!panierSelectionneCle) return
    setPanier((prev) => prev.filter((l) => l.cle !== panierSelectionneCle))
    setPanierSelectionneCle(null)
  }

  async function onValider() {
    if (panier.length === 0) {
      setErreur('Ajoute au moins une ligne au panier.')
      return
    }
    setErreur(null)
    setEnvoi(true)
    try {
      const numero = await creerReintegration(
        entrepotId,
        notes || null,
        panier.map((l) => ({ bonSortieLigneId: l.bonSortieLigneId, emplacementId: l.emplacementId, quantite: l.quantite })),
        dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
      )
      setDernierNumero(numero)
      setPanier([])
      setNotes('')
      setDateMouvement(dateVersInput(new Date()))
      chargerSorties()
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setEnvoi(false)
    }
  }

  if (chargement) {
    return <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
  }

  const produitAffiche = ligneSelectionnee
    ? { reference: ligneSelectionnee.produit_reference, designation: ligneSelectionnee.produit_designation }
    : produitsReintegrables.find((p) => p.produitId === produitSelectionneId)

  return (
    <div className="h-full flex flex-col gap-1.5 p-3 overflow-y-auto">
      <div className="shrink-0 flex items-baseline justify-between gap-3">
        <h1 className="text-base font-bold text-text">Réintégration</h1>
        <p className="text-[11px] text-text-muted">Annule tout ou partie d'une sortie déjà confirmée, sans supprimer l'historique</p>
      </div>

      <div className="shrink-0 bg-card rounded-lg border border-border px-3 py-2 grid grid-cols-[260px_1fr] gap-x-6">
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Référence</span>
            <div className={CLASSE_CHAMP_LECTURE}>{produitAffiche?.reference ?? '—'}</div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Désignation</span>
            <div className={CLASSE_CHAMP_LECTURE}>{produitAffiche?.designation ?? '—'}</div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Dépôt</span>
            <select value={entrepotId} onChange={(e) => onChangerEntrepot(e.target.value)} className={CLASSE_INPUT}>
              {entrepots.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Localisation de retour</span>
            <select
              value={emplacementChoisi}
              onChange={(e) => setEmplacementChoisi(e.target.value)}
              disabled={!ligneSelectionnee}
              className={`${CLASSE_INPUT} disabled:bg-muted disabled:text-text-muted`}
            >
              {emplacements.length === 0 && <option value="">—</option>}
              {emplacements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code}
                  {e.est_quarantaine ? ' (Quarantaine)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Quantité maxi disponible</span>
            <div className={CLASSE_CHAMP_LECTURE}>{ligneSelectionnee?.quantite_disponible ?? '—'}</div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Quantité à réintégrer</span>
            <input
              type="number"
              min="1"
              max={ligneSelectionnee?.quantite_disponible}
              value={quantiteChoisie}
              onChange={(e) => setQuantiteChoisie(e.target.value)}
              disabled={!ligneSelectionnee}
              className={`${CLASSE_INPUT} disabled:bg-muted disabled:text-text-muted`}
            />
          </label>
        </div>

        <div className="grid grid-cols-[220px_1fr] gap-x-6 py-1">
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-0.5">
              <span className={CLASSE_LABEL}>Opérateur</span>
              <div className={CLASSE_CHAMP_LECTURE}>{profil?.nom_complet ?? '—'}</div>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className={CLASSE_LABEL}>Bon de réintégration</span>
              <div className={CLASSE_CHAMP_LECTURE}>{dernierNumero ?? 'Généré à la validation'}</div>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className={CLASSE_LABEL}>Date du mouvement</span>
              <input
                type="date"
                value={dateMouvement}
                onChange={(e) => setDateMouvement(e.target.value)}
                className={CLASSE_INPUT}
              />
            </label>
          </div>
          <label className="flex flex-col gap-0.5 min-h-0">
            <span className={CLASSE_LABEL}>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 flex-1 resize-none"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,280px)_1fr] gap-1.5">
        <div className="bg-card rounded-lg border border-border p-2 flex flex-col gap-1.5 min-h-0">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
            Références à réintégrer <span className="normal-case text-text-muted">(* = contient)</span>
          </div>
          <div className="flex items-center gap-2 border border-border rounded-lg px-2.5 py-2">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              value={rechercheProduit}
              onChange={(e) => setRechercheProduit(e.target.value)}
              placeholder="Référence..."
              className="text-sm outline-none w-full"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-[10px] text-text-muted uppercase tracking-wide">
                  <th className="font-medium py-0.5">Référence</th>
                  <th className="font-medium py-0.5 text-right">Qté</th>
                </tr>
              </thead>
              <tbody>
                {produitsFiltres.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-text-muted text-center py-6">
                      Aucune sortie à réintégrer sur la période.
                    </td>
                  </tr>
                )}
                {produitsFiltres.map((p) => (
                  <tr
                    key={p.produitId}
                    onClick={() => onSelectionnerProduit(p.produitId)}
                    className={`cursor-pointer border-t border-border ${
                      produitSelectionneId === p.produitId ? 'bg-accent-soft' : 'hover:bg-muted'
                    }`}
                    title={p.designation}
                  >
                    <td className="py-0.5 font-mono text-text">{p.reference}</td>
                    <td className="py-0.5 text-right font-semibold text-text">{p.quantiteDisponible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 flex flex-col gap-1">
            <button
              type="button"
              onClick={onAjouterAuPanier}
              disabled={!ligneSelectionnee || emplacements.length === 0}
              className="text-xs font-semibold bg-card border border-border rounded-md py-1 hover:border-text-muted disabled:opacity-60"
            >
              Ajouter
            </button>
            <button
              type="button"
              onClick={onSupprimerDuPanier}
              disabled={!panierSelectionneCle}
              className="text-xs font-semibold bg-card border border-border rounded-md py-1 hover:border-text-muted disabled:opacity-60"
            >
              Supprimer
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-h-0">
          <div className="shrink-0 bg-card rounded-lg border border-border p-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Détail des sorties</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-text-muted">Entre le</span>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="border border-border rounded-md px-1.5 py-0.5 text-xs"
                />
                <span className="text-text-muted">et le</span>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="border border-border rounded-md px-1.5 py-0.5 text-xs"
                />
                <button
                  type="button"
                  onClick={chargerSorties}
                  className="text-xs font-semibold bg-card border border-border rounded-md px-2 py-0.5 hover:border-text-muted"
                >
                  Filtrer
                </button>
              </div>
            </div>

            {!produitSelectionneId ? (
              <p className="text-xs text-text-muted py-3 text-center">
                Choisis une référence à gauche pour voir ses sorties.
              </p>
            ) : lignesDuProduit.length === 0 ? (
              <p className="text-xs text-text-muted py-3 text-center">Aucune sortie sur la période sélectionnée.</p>
            ) : (
              <div className="max-h-[22vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-[10px] text-text-muted uppercase tracking-wide">
                      <th className="font-medium py-0.5">Date</th>
                      <th className="font-medium py-0.5">Motif</th>
                      <th className="font-medium py-0.5">Document</th>
                      <th className="font-medium py-0.5">Qté sortie</th>
                      <th className="font-medium py-0.5">Disponible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesDuProduit.map((l) => (
                      <tr
                        key={l.bon_sortie_ligne_id}
                        onClick={() => setLigneSelectionnee(l)}
                        className={`border-t border-border cursor-pointer ${
                          ligneSelectionnee?.bon_sortie_ligne_id === l.bon_sortie_ligne_id ? 'bg-accent-soft' : 'hover:bg-muted'
                        }`}
                      >
                        <td className="py-0.5">{new Date(l.sortie_le).toLocaleDateString('fr-FR')}</td>
                        <td className="py-0.5 text-text-muted">{l.motif ?? '—'}</td>
                        <td className="py-0.5 font-mono text-text-muted">{l.bon_sortie_numero}</td>
                        <td className="py-0.5 text-text">{l.quantite_sortie}</td>
                        <td className="py-0.5 font-semibold text-text">{l.quantite_disponible}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="shrink-0 text-[11px] font-semibold text-text-muted uppercase tracking-wide px-2 py-1 border-b border-border">
              Panier des réintégrations ({panier.length})
            </div>
            <div className="overflow-auto flex-1">
              {panier.length === 0 ? (
                <p className="text-xs text-text-muted py-6 text-center">Aucune ligne ajoutée pour l'instant.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="text-left text-[10px] text-text-muted uppercase tracking-wide">
                      <th className="font-medium py-1 px-2">Référence</th>
                      <th className="font-medium py-1 px-2">Désignation</th>
                      <th className="font-medium py-1 px-2">Localisation</th>
                      <th className="font-medium py-1 px-2">Qté</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panier.map((l) => (
                      <tr
                        key={l.cle}
                        onClick={() => setPanierSelectionneCle(l.cle)}
                        className={`border-t border-border cursor-pointer ${
                          panierSelectionneCle === l.cle ? 'bg-accent-soft' : 'hover:bg-muted'
                        }`}
                      >
                        <td className="py-1 px-2 font-mono text-text-muted">{l.reference}</td>
                        <td className="py-1 px-2 text-text">{l.designation}</td>
                        <td className="py-1 px-2 text-text-muted">{l.emplacementCode}</td>
                        <td className="py-1 px-2 font-semibold text-text">{l.quantite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-end gap-3">
        {erreur && <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}
        <button onClick={onValider} disabled={envoi || panier.length === 0} className={CLASSE_BOUTON_PRIMAIRE}>
          {envoi ? 'Validation...' : `Valider la réintégration (${panier.length})`}
        </button>
      </div>
    </div>
  )
}

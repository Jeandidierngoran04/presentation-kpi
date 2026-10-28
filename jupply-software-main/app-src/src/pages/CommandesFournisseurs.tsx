import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Lock, PackageCheck, Plus, Send, Truck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTabs } from '../context/TabsContext'
import { useToast } from '../context/ToastContext'
import { messageErreur } from '../lib/erreurs'
import { peutValiderReception } from '../lib/permissions'
import { texteFiltre } from '../lib/filtreTexte'
import {
  changerStatutCommande,
  cloturerCommande,
  commandeReceptionnable,
  commandeTerminee,
  getCommandes,
  getLignesCommande,
  getReceptionsCommande,
  STATUTS_COMMANDE,
  type CommandeFournisseur,
  type LigneCommande,
  type ReceptionDeCommande,
  type StatutCommande,
} from '../lib/api/commandes'
import { useMenuContextuel } from '../components/ui/MenuContextuel'
import { classeBadge } from '../components/ui/Badge'
import { EnTetePage } from '../components/ui/EnTetePage'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { ReceptionCommandeModal } from '../components/commandes/ReceptionCommandeModal'
import { ChampRecherche } from '../components/ui/ChampRecherche'
import { CLASSE_BOUTON_PRIMAIRE_PETIT } from '../components/ui/styles'

type Filtre = 'actives' | 'toutes' | StatutCommande
type Action = 'envoye' | 'en_transit' | 'cloturer' | 'receptionner'

const ORDRE_STATUTS: StatutCommande[] = ['fait', 'envoye', 'en_transit', 'en_cours_reception', 'completee', 'cloturee']

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')
const montantXof = (n: number) => `${n.toLocaleString('fr-FR')} XOF`

const CLASSE_BOUTON_ACTION =
  'inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-text text-xs font-semibold rounded-md px-2.5 h-7 ' +
  'disabled:opacity-50 disabled:pointer-events-none'

export function CommandesFournisseurs() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ongletActifId, ouvrirOnglet } = useTabs()
  const { afficherToast } = useToast()
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [recherche, setRecherche] = useState('')
  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [lignes, setLignes] = useState<LigneCommande[]>([])
  const [receptions, setReceptions] = useState<ReceptionDeCommande[]>([])
  const [action, setAction] = useState<Action | null>(null)
  const [motifCloture, setMotifCloture] = useState('')
  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()

  function chargerListe() {
    getCommandes()
      .then(setCommandes)
      .catch((e) => setErreur(messageErreur(e)))
      .finally(() => setChargement(false))
  }

  function chargerDetail(id: string) {
    Promise.all([getLignesCommande(id), getReceptionsCommande(id)])
      .then(([l, r]) => {
        setLignes(l)
        setReceptions(r)
      })
      .catch((e) => setErreur(messageErreur(e)))
  }

  useEffect(() => {
    if (ongletActifId === 'commandes-fournisseurs') chargerListe()
  }, [ongletActifId])

  useEffect(() => {
    if (selectionId) chargerDetail(selectionId)
  }, [selectionId])

  const compteurs = useMemo(() => {
    const c = Object.fromEntries(ORDRE_STATUTS.map((s) => [s, 0])) as Record<StatutCommande, number>
    for (const cmd of commandes) c[cmd.statut]++
    return c
  }, [commandes])

  const commandesFiltrees = useMemo(() => {
    const terme = recherche.trim()
    return commandes.filter((c) => {
      if (filtre === 'actives' && commandeTerminee(c.statut)) return false
      if (filtre !== 'actives' && filtre !== 'toutes' && c.statut !== filtre) return false
      return !terme || [c.numero, c.fournisseur_nom, c.entrepot_nom].some((v) => texteFiltre(v, terme))
    })
  }, [commandes, filtre, recherche])

  const selection = commandes.find((c) => c.id === selectionId) ?? null
  const peutReceptionner =
    selection != null && peutValiderReception(profil?.role, selection.entrepot_id, entrepotsAssignes)

  function nouvelleCommande() {
    ouvrirOnglet('nouvelle-commande', 'Nouvelle commande')
  }

  function onClicDroit(e: MouseEvent) {
    ouvrirMenu(e, [{ label: 'Créer une commande', onClick: nouvelleCommande }])
  }

  function apresAction(message: string) {
    setAction(null)
    setMotifCloture('')
    afficherToast(message)
    chargerListe()
    if (selectionId) chargerDetail(selectionId)
  }

  async function changerStatut(statut: 'envoye' | 'en_transit') {
    if (!selection) return
    await changerStatutCommande(selection.id, statut)
    apresAction(`${selection.numero} : ${STATUTS_COMMANDE[statut].label}`)
  }

  async function cloturer() {
    if (!selection) return
    await cloturerCommande(selection.id, motifCloture.trim())
    apresAction(`${selection.numero} clôturée`)
  }

  if (erreur) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="max-w-lg mx-auto mt-12 bg-danger-soft text-danger-deep text-sm rounded-xl p-5">{erreur}</div>
      </div>
    )
  }

  const pastilles: { id: Filtre; label: string; nombre: number }[] = [
    { id: 'toutes', label: 'Toutes', nombre: commandes.length },
    { id: 'actives', label: 'En cours', nombre: commandes.filter((c) => !commandeTerminee(c.statut)).length },
    ...ORDRE_STATUTS.map((s) => ({ id: s as Filtre, label: STATUTS_COMMANDE[s].label, nombre: compteurs[s] })),
  ]

  const reliquat = lignes.reduce((t, l) => t + l.quantite_restante, 0)

  return (
    <div className="h-full flex flex-col gap-2 p-4" onContextMenu={onClicDroit}>
      <EnTetePage
        titre="Commandes fournisseurs"
        compteur={commandesFiltrees.length}
        actions={
          <button
            type="button"
            onClick={nouvelleCommande}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-strong text-accent-contrast text-xs font-semibold rounded-md px-3 h-8"
          >
            <Plus size={14} strokeWidth={1.75} /> Créer une commande
          </button>
        }
      />

      <div className="shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {pastilles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFiltre(p.id)}
              className={`h-7 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                filtre === p.id ? 'bg-nav-actif border-accent/50 text-text' : 'border-border text-text-muted hover:bg-muted'
              }`}
            >
              {p.label} <span className="tabular-nums text-text-muted">({p.nombre})</span>
            </button>
          ))}
        </div>
        <ChampRecherche valeur={recherche} onChange={setRecherche} aide="N° de commande, fournisseur ou dépôt (* en tête = contient)" className="ml-auto w-[260px]" />
      </div>

      {chargement ? (
        <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
      ) : (
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="tableau-dense tableau-ajuste">
              <colgroup>
                <col style={{ width: '11%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="text-left">
                  <th>N° PO</th>
                  <th>Fournisseur</th>
                  <th>Dépôt de livraison</th>
                  <th>Statut</th>
                  <th>Commandée le</th>
                  <th>Livraison prévue</th>
                  <th className="text-right">Lignes</th>
                  <th>Reçu / commandé</th>
                  <th className="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {commandesFiltrees.map((c) => {
                  const terminee = commandeTerminee(c.statut)
                  const enRetard =
                    !terminee && c.date_livraison_prevue != null && new Date(`${c.date_livraison_prevue}T23:59:59`) < new Date()
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectionId(c.id)}
                      className={`cursor-pointer ${selectionId === c.id ? 'bg-accent-soft' : 'hover:bg-muted'} ${
                        terminee ? 'text-text-muted opacity-60' : ''
                      }`}
                    >
                      <td className="font-mono text-xs text-info-deep">{c.numero}</td>
                      <td className="font-medium">{c.fournisseur_nom}</td>
                      <td>{c.entrepot_nom}</td>
                      <td>
                        <span className={classeBadge(STATUTS_COMMANDE[c.statut].ton)}>{STATUTS_COMMANDE[c.statut].label}</span>
                      </td>
                      <td className="tabular-nums">{date(c.date_commande)}</td>
                      <td className={`tabular-nums ${enRetard ? 'text-danger-deep font-semibold' : ''}`} title={enRetard ? 'Livraison en retard' : undefined}>
                        {date(c.date_livraison_prevue)}
                      </td>
                      <td className="text-right tabular-nums">{c.nb_lignes}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.pourcentage_recu >= 100 ? 'bg-accent' : 'bg-info'}`}
                              style={{ width: `${c.pourcentage_recu}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-[11px] text-text-muted">
                            {c.quantite_recue}/{c.quantite_commandee}
                          </span>
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{c.montant.toLocaleString('fr-FR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {commandesFiltrees.length === 0 && (
              <p className="text-sm text-text-muted py-8 text-center">
                {commandes.length === 0 ? 'Aucune commande. Clique sur « Créer une commande ».' : 'Aucune commande ne correspond au filtre.'}
              </p>
            )}
          </div>
        </div>
      )}

      {selection && (
        <div className="shrink-0 max-h-[36vh] overflow-y-auto bg-card rounded-lg border border-border p-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-semibold text-text uppercase tracking-wide">{selection.numero}</h2>
              <span className={classeBadge(STATUTS_COMMANDE[selection.statut].ton)}>{STATUTS_COMMANDE[selection.statut].label}</span>
              <span className="text-xs text-text-muted">
                {selection.fournisseur_nom} · {montantXof(selection.montant)} · émise par {selection.cree_par_nom ?? '—'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {selection.statut === 'fait' && (
                <button type="button" className={CLASSE_BOUTON_ACTION} onClick={() => setAction('envoye')}>
                  <Send size={13} strokeWidth={1.75} /> Marquer envoyée
                </button>
              )}
              {selection.statut === 'envoye' && (
                <button type="button" className={CLASSE_BOUTON_ACTION} onClick={() => setAction('en_transit')}>
                  <Truck size={13} strokeWidth={1.75} /> Marquer en transit
                </button>
              )}
              {commandeReceptionnable(selection.statut) && peutReceptionner && (
                <button type="button" className={CLASSE_BOUTON_PRIMAIRE_PETIT} onClick={() => setAction('receptionner')}>
                  <PackageCheck size={13} strokeWidth={1.75} /> Réceptionner
                </button>
              )}
              {!commandeTerminee(selection.statut) && (
                <button type="button" className={CLASSE_BOUTON_ACTION} onClick={() => setAction('cloturer')}>
                  <Lock size={13} strokeWidth={1.75} /> Clôturer
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-4 flex-wrap text-[11.5px] text-text-muted">
            <span>Commandée le {date(selection.date_commande)}</span>
            {selection.envoye_le && <span>Envoyée le {date(selection.envoye_le)}</span>}
            {selection.transit_le && <span>En transit le {date(selection.transit_le)}</span>}
            {selection.completee_le && <span>Complétée le {date(selection.completee_le)}</span>}
            {selection.cloturee_le && (
              <span>
                Clôturée le {date(selection.cloturee_le)} : <span className="text-text">{selection.motif_cloture}</span>
              </span>
            )}
            {receptions.length > 0 && (
              <span>
                Réceptions : <span className="font-mono text-text">{receptions.map((r) => r.numero).join(', ')}</span>
              </span>
            )}
          </div>
          {selection.notes && (
            <p className="text-xs text-text-muted">
              <span className="font-semibold text-text">Notes :</span> {selection.notes}
            </p>
          )}

          <table className="tableau-dense tableau-ajuste">
            <colgroup>
              <col style={{ width: '13%' }} />
              <col style={{ width: '33%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr className="text-left">
                <th>Référence</th>
                <th>Désignation</th>
                <th className="text-right">Commandé</th>
                <th className="text-right">Reçu</th>
                <th className="text-right">Reste</th>
                <th className="text-right">Prix unit.</th>
                <th className="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs text-text-muted">{l.produit_reference}</td>
                  <td className="font-medium">{l.produit_designation}</td>
                  <td className="text-right tabular-nums">{l.quantite_commandee}</td>
                  <td className="text-right tabular-nums">{l.quantite_recue}</td>
                  <td className={`text-right tabular-nums ${l.quantite_restante > 0 ? 'font-semibold text-info-deep' : 'text-accent-deep'}`}>
                    {l.quantite_restante > 0 ? l.quantite_restante : 'OK'}
                  </td>
                  <td className="text-right tabular-nums">{l.prix_unitaire.toLocaleString('fr-FR')}</td>
                  <td className="text-right tabular-nums">{l.montant.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selection && action === 'envoye' && (
        <ConfirmationModal
          titre="Marquer la commande comme envoyée ?"
          libelleConfirmer="Oui, elle est envoyée"
          onConfirmer={() => changerStatut('envoye')}
          onFermer={() => setAction(null)}
        >
          <p>
            Confirme que le bon <span className="font-semibold">{selection.numero}</span> a bien été transmis à{' '}
            <span className="font-semibold">{selection.fournisseur_nom}</span>.
          </p>
          <p className="text-xs text-text-muted">Les réceptions deviennent possibles à partir de ce statut.</p>
        </ConfirmationModal>
      )}
      {selection && action === 'en_transit' && (
        <ConfirmationModal
          titre="Marquer la commande en transit ?"
          libelleConfirmer="Oui, elle est en route"
          onConfirmer={() => changerStatut('en_transit')}
          onFermer={() => setAction(null)}
        >
          <p>
            Le fournisseur <span className="font-semibold">{selection.fournisseur_nom}</span> t'a notifié que la commande{' '}
            <span className="font-semibold">{selection.numero}</span> est en route ?
          </p>
        </ConfirmationModal>
      )}
      {selection && action === 'cloturer' && (
        <ConfirmationModal
          titre="Clôturer la commande ?"
          libelleConfirmer="Clôturer définitivement"
          danger
          confirmationImpossible={!motifCloture.trim()}
          onConfirmer={cloturer}
          onFermer={() => {
            setAction(null)
            setMotifCloture('')
          }}
        >
          <p>
            La commande <span className="font-semibold">{selection.numero}</span> sera fermée : plus aucune réception ne sera possible.
          </p>
          {reliquat > 0 && (
            <p className="text-xs text-warn-deep font-semibold">
              Il reste {reliquat.toLocaleString('fr-FR')} unité(s) non livrée(s) : elles ne seront plus attendues.
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Motif de clôture (obligatoire)</span>
            <textarea
              value={motifCloture}
              onChange={(e) => setMotifCloture(e.target.value)}
              rows={2}
              placeholder="Ex. Fournisseur en rupture, reliquat annulé"
              className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none resize-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </label>
        </ConfirmationModal>
      )}
      {selection && action === 'receptionner' && (
        <ReceptionCommandeModal
          commande={selection}
          lignes={lignes}
          onFermer={() => setAction(null)}
          onReceptionnee={apresAction}
        />
      )}

      {menu}
    </div>
  )
}

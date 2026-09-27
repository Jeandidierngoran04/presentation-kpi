import { useEffect, useState, type FormEvent } from 'react'
import { MapPin, Plus, ShieldAlert, Warehouse } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { peutGererEmplacements, peutGererEntrepots } from '../lib/permissions'
import {
  creerEmplacement,
  creerEntrepot,
  getEmplacements,
  getEntrepots,
  type EntrepotAvecStats,
} from '../lib/api/entrepots'
import type { Emplacement } from '../types/stock'
import { Modal } from '../components/ui/Modal'

const CLASSE_INPUT = 'border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
const CLASSE_BOUTON_PRIMAIRE =
  'bg-accent hover:bg-accent-strong text-accent-contrast text-sm font-semibold rounded-lg py-2.5 transition-colors disabled:opacity-60'

export function Entrepots() {
  const { profil, entrepotsAssignes } = useAuth()
  const [entrepots, setEntrepots] = useState<EntrepotAvecStats[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [entrepotSelectionne, setEntrepotSelectionne] = useState<string | null>(null)
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [modalEntrepotOuvert, setModalEntrepotOuvert] = useState(false)
  const [modalEmplacementOuvert, setModalEmplacementOuvert] = useState(false)

  function chargerEntrepots() {
    setChargement(true)
    getEntrepots()
      .then(setEntrepots)
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  useEffect(chargerEntrepots, [])

  useEffect(() => {
    if (!entrepotSelectionne) return
    getEmplacements(entrepotSelectionne).then(setEmplacements)
  }, [entrepotSelectionne])

  async function onCreerEntrepot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profil) return
    const donnees = new FormData(e.currentTarget)
    await creerEntrepot({
      entrepriseId: profil.entreprise_id,
      nom: String(donnees.get('nom')),
      adresse: String(donnees.get('adresse') || '') || null,
    })
    setModalEntrepotOuvert(false)
    chargerEntrepots()
  }

  async function onCreerEmplacement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!entrepotSelectionne) return
    const donnees = new FormData(e.currentTarget)
    await creerEmplacement({
      entrepotId: entrepotSelectionne,
      code: String(donnees.get('code')),
      zone: String(donnees.get('zone') || '') || null,
      rayon: String(donnees.get('rayon') || '') || null,
      etagere: String(donnees.get('etagere') || '') || null,
    })
    setModalEmplacementOuvert(false)
    getEmplacements(entrepotSelectionne).then(setEmplacements)
    chargerEntrepots()
  }

  if (erreur) {
    return (
      <div className="h-full overflow-y-auto bg-canvas p-4">
        <div className="max-w-lg mx-auto mt-12 bg-danger-soft text-danger-deep text-sm rounded-xl p-5">{erreur}</div>
      </div>
    )
  }

  const entrepot = entrepots.find((e) => e.id === entrepotSelectionne)
  const autorisePourEmplacements =
    entrepotSelectionne !== null && peutGererEmplacements(profil?.role, entrepotSelectionne, entrepotsAssignes)

  return (
    <div className="h-full overflow-y-auto bg-canvas p-4 flex flex-col gap-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">Entrepôts</h1>
          <p className="text-[13px] text-text-muted mt-1">Sites de stockage, zones et emplacements.</p>
        </div>
        {peutGererEntrepots(profil?.role) && (
          <button
            onClick={() => setModalEntrepotOuvert(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-accent text-accent-contrast rounded-lg px-3 py-2 hover:bg-accent-strong transition-colors"
          >
            <Plus size={14} strokeWidth={1.75} /> Nouvel entrepôt
          </button>
        )}
      </div>

      {chargement ? (
        <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
      ) : entrepots.length === 0 ? (
        <div className="text-sm text-text-muted py-12 text-center">Aucun entrepôt enregistré.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {entrepots.map((e) => (
            <button
              key={e.id}
              onClick={() => setEntrepotSelectionne(e.id)}
              className={`text-left bg-card rounded-xl border p-4 transition-colors ${
                entrepotSelectionne === e.id ? 'border-accent' : 'border-border hover:border-text-muted'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent-deep flex items-center justify-center mb-3">
                <Warehouse size={17} strokeWidth={1.75} />
              </div>
              <div className="text-base font-semibold text-text">{e.nom}</div>
              {e.adresse && <div className="text-xs text-text-muted mt-0.5">{e.adresse}</div>}
              <div className="flex gap-4 mt-3 text-xs text-text-muted">
                <span>{e.nb_emplacements} emplacement(s)</span>
                <span>{e.quantite_totale.toLocaleString('fr-FR')} unités</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {entrepot && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-text">
              Emplacements — {entrepot.nom}
            </h2>
            {autorisePourEmplacements && (
              <button
                onClick={() => setModalEmplacementOuvert(true)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-card border border-border text-text rounded-lg px-3 py-2 hover:border-text-muted"
              >
                <Plus size={13} /> Ajouter un emplacement
              </button>
            )}
          </div>

          {emplacements.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">Aucun emplacement pour le moment.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide">
                  <th className="font-medium pb-2">Code</th>
                  <th className="font-medium pb-2">Zone</th>
                  <th className="font-medium pb-2">Rayon</th>
                  <th className="font-medium pb-2">Étagère</th>
                </tr>
              </thead>
              <tbody>
                {emplacements.map((emp) => (
                  <tr key={emp.id} className="border-t border-border">
                    <td className="py-2.5 font-medium text-text">
                      {emp.est_quarantaine ? (
                        <span className="inline-flex items-center gap-1.5 text-warn-deep">
                          <ShieldAlert size={13} /> {emp.code}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={13} className="text-text-muted" /> {emp.code}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-text-muted">{emp.zone ?? '—'}</td>
                    <td className="py-2.5 text-text-muted">{emp.rayon ?? '—'}</td>
                    <td className="py-2.5 text-text-muted">{emp.etagere ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalEntrepotOuvert && (
        <Modal titre="Nouvel entrepôt" onFermer={() => setModalEntrepotOuvert(false)}>
          <form onSubmit={onCreerEntrepot} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Nom</span>
              <input name="nom" required className={CLASSE_INPUT} placeholder="Entrepôt Nord" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Adresse (optionnel)</span>
              <input name="adresse" className={CLASSE_INPUT} placeholder="Zone industrielle, Abidjan" />
            </label>
            <button type="submit" className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
              Créer l'entrepôt
            </button>
          </form>
        </Modal>
      )}

      {modalEmplacementOuvert && (
        <Modal titre="Nouvel emplacement" onFermer={() => setModalEmplacementOuvert(false)}>
          <form onSubmit={onCreerEmplacement} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Code</span>
              <input name="code" required className={CLASSE_INPUT} placeholder="A1" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Zone (optionnel)</span>
              <input name="zone" className={CLASSE_INPUT} placeholder="Zone A" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Rayon (optionnel)</span>
              <input name="rayon" className={CLASSE_INPUT} placeholder="Rayon 1" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-muted">Étagère (optionnel)</span>
              <input name="etagere" className={CLASSE_INPUT} placeholder="Étagère 1" />
            </label>
            <button type="submit" className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
              Créer l'emplacement
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

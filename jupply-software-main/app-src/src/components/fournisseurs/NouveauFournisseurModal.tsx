import { useState, type FormEvent } from 'react'
import { messageErreur } from '../../lib/erreurs'
import { creerFournisseur } from '../../lib/api/produits'
import type { Fournisseur } from '../../types/stock'
import { Modal } from '../ui/Modal'
import { CLASSE_BOUTON_PRIMAIRE, CLASSE_BOUTON_SECONDAIRE, CLASSE_CHAMP, CLASSE_LABEL } from '../ui/styles'
import { BandeauErreur } from '../ui/BandeauErreur'

interface NouveauFournisseurModalProps {
  entrepriseId: string
  /** Nom déjà tapé ailleurs, repris comme valeur de départ. */
  nomInitial?: string
  onFermer: () => void
  onCree: (fournisseur: Fournisseur) => void
}

/** Fiche de création d'un fournisseur avec ses coordonnées. */
export function NouveauFournisseurModal({ entrepriseId, nomInitial = '', onFermer, onCree }: NouveauFournisseurModalProps) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const donnees = new FormData(e.currentTarget)
    const champ = (nom: string) => String(donnees.get(nom) ?? '').trim()
    const nom = champ('nom')
    if (!nom) {
      setErreur('Le nom du fournisseur est obligatoire.')
      return
    }
    setErreur(null)
    setEnvoi(true)
    try {
      const fournisseur = await creerFournisseur(entrepriseId, nom, {
        contact: champ('contact'),
        telephone: champ('telephone'),
        email: champ('email'),
        adresse: champ('adresse'),
        ville: champ('ville'),
        pays: champ('pays'),
      })
      onCree(fournisseur)
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre="Nouveau fournisseur" onFermer={onFermer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Nom *</span>
          <input name="nom" autoFocus defaultValue={nomInitial} className={CLASSE_CHAMP} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Personne à contacter</span>
          <input name="contact" className={CLASSE_CHAMP} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Téléphone</span>
            <input name="telephone" type="tel" className={CLASSE_CHAMP} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>E-mail</span>
            <input name="email" type="email" className={CLASSE_CHAMP} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Adresse</span>
          <input name="adresse" className={CLASSE_CHAMP} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Ville</span>
            <input name="ville" className={CLASSE_CHAMP} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Pays</span>
            <input name="pays" className={CLASSE_CHAMP} />
          </label>
        </div>

        <BandeauErreur message={erreur} className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2" />

        <div className="flex justify-end gap-2 mt-1">
          <button type="button" onClick={onFermer} data-annuler className={CLASSE_BOUTON_SECONDAIRE}>
            Annuler
          </button>
          <button type="submit" disabled={envoi} className={CLASSE_BOUTON_PRIMAIRE}>
            {envoi ? 'Création...' : 'Créer le fournisseur'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

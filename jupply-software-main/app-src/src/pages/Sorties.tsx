import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, Plus } from 'lucide-react'
import { useTabs } from '../context/TabsContext'
import { useSelection, type SortieValidee } from '../context/SelectionContext'
import { messageErreur } from '../lib/erreurs'
import { getBonSortie, getLignesBonSortie } from '../lib/api/historique'
import { ouvrirBonSortiePdf } from '../lib/export/bonSortiePdf'
import { ListeDocuments } from '../components/historique/ListeDocuments'
import { CONFIG_SORTIES } from '../components/historique/configs'
import { Modal } from '../components/ui/Modal'
import { CLASSE_BOUTON_PRIMAIRE, CLASSE_BOUTON_PRIMAIRE_PETIT, CLASSE_BOUTON_SECONDAIRE } from '../components/ui/styles'

/** Jeton de la dernière sortie déjà confirmée (survit à la fermeture de l'onglet). */
let dernierJetonConfirme = 0

/**
 * Point d'entrée des sorties : la liste des bons du jour. "Nouvelle sortie"
 * ouvre la feuille de saisie dans son propre onglet ; au retour, le bon créé
 * est mis en avant et son impression est proposée.
 */
export function Sorties() {
  const { ongletActifId, ouvrirOnglet } = useTabs()
  const { derniereSortie } = useSelection()
  const [confirmation, setConfirmation] = useState<SortieValidee | null>(null)
  const [impression, setImpression] = useState(false)
  const [erreurImpression, setErreurImpression] = useState<string | null>(null)

  // Une sortie vient d'être validée dans l'onglet "Nouvelle sortie". La
  // confirmation n'est montrée qu'une fois, même si cet onglet est rouvert.
  useEffect(() => {
    if (derniereSortie && derniereSortie.jeton !== dernierJetonConfirme) {
      dernierJetonConfirme = derniereSortie.jeton
      setConfirmation(derniereSortie)
      setErreurImpression(null)
    }
  }, [derniereSortie])

  function nouvelleSortie() {
    setConfirmation(null)
    ouvrirOnglet('nouvelle-sortie', 'Nouvelle sortie')
  }

  async function imprimer(sortie: SortieValidee) {
    // Onglet ouvert tout de suite, au moment du clic, sinon le navigateur le bloque.
    const fenetre = window.open('', '_blank')
    setImpression(true)
    setErreurImpression(null)
    try {
      const [bon, lignes] = await Promise.all([getBonSortie(sortie.id), getLignesBonSortie(sortie.id)])
      if (!bon) throw new Error('Bon de sortie introuvable.')
      await ouvrirBonSortiePdf(bon, lignes, fenetre)
      setConfirmation(null)
    } catch (e) {
      fenetre?.close()
      setErreurImpression(messageErreur(e))
    } finally {
      setImpression(false)
    }
  }

  return (
    <>
      <ListeDocuments
        config={CONFIG_SORTIES}
        estActif={ongletActifId === 'sorties'}
        titre="Sorties du jour"
        duJourSeulement
        idEnSurbrillance={derniereSortie?.id ?? null}
        jetonRechargement={derniereSortie?.jeton ?? 0}
        elementsMenuTableau={[{ label: 'Nouvelle sortie', onClick: nouvelleSortie }]}
        actions={
          <button type="button" onClick={nouvelleSortie} className={`${CLASSE_BOUTON_PRIMAIRE_PETIT} h-8`}>
            <Plus size={14} strokeWidth={1.75} /> Nouvelle sortie
          </button>
        }
      />

      {confirmation && (
        <Modal titre="Bon de sortie enregistré" onFermer={() => setConfirmation(null)} sansConfirmationFermeture>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-accent-soft text-accent-deep flex items-center justify-center">
                <CheckCircle2 size={20} strokeWidth={1.75} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-base font-semibold text-text">{confirmation.numero}</span>
                <span className="text-xs text-text-muted">
                  {confirmation.nbLignes} ligne(s) · {confirmation.quantite.toLocaleString('fr-FR')} unité(s) sortie(s)
                  {confirmation.recuPar ? ` · reçu par ${confirmation.recuPar}` : ''}
                </span>
              </div>
            </div>
            <p className="text-[13px] text-text-muted">
              Le bon de sortie sert de fiche de préparation : chaque ligne indique la localisation et le lot à prélever.
            </p>
            {erreurImpression && (
              <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreurImpression}</div>
            )}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => imprimer(confirmation)} disabled={impression} className={CLASSE_BOUTON_PRIMAIRE}>
                <FileText size={15} strokeWidth={1.75} /> {impression ? 'Préparation du PDF...' : 'Imprimer le bon (PDF)'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={nouvelleSortie} className={CLASSE_BOUTON_SECONDAIRE}>
                  <Plus size={15} strokeWidth={1.75} /> Nouvelle sortie
                </button>
                <button type="button" onClick={() => setConfirmation(null)} className={CLASSE_BOUTON_SECONDAIRE}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

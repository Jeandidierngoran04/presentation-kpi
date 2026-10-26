// Définition des listes de l'Historique (une par type de document). Les objets
// sont déclarés une seule fois ici : ListeDocuments s'appuie sur leur stabilité.
import type { BonSortieHistorique, DocumentHistorique, LigneBonSortie } from '../../lib/api/historique'
import { ouvrirBonSortiePdf } from '../../lib/export/bonSortiePdf'
import { libelleDecision, libelleMotif, ORIGINES_NC, STATUTS_NC, type StatutNc } from '../../lib/api/quarantaine'
import { STATUTS_COMMANDE, type StatutCommande } from '../../lib/api/commandes'
import { Badge, type TonBadge } from '../ui/Badge'
import type { ConfigDocuments } from './ListeDocuments'

function dateHeure(iso: unknown): Date | null {
  return typeof iso === 'string' ? new Date(iso) : null
}
function texteDateHeure(iso: unknown): string {
  return typeof iso === 'string'
    ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
}
function texteDate(iso: unknown): string {
  return typeof iso === 'string' ? new Date(iso).toLocaleDateString('fr-FR') : ''
}
const txt = (v: unknown) => (v == null ? null : String(v))
const nb = (v: unknown) => (typeof v === 'number' ? v : null)

function triTournee(a: { emplacement_code: string | null; produit_reference: string }, b: typeof a) {
  return (
    (a.emplacement_code ?? '').localeCompare(b.emplacement_code ?? '', 'fr', { numeric: true }) ||
    a.produit_reference.localeCompare(b.produit_reference, 'fr', { numeric: true })
  )
}

// --- Sorties ---------------------------------------------------------------

export const CONFIG_SORTIES: ConfigDocuments<BonSortieHistorique, LigneBonSortie> = {
  vue: 'v_historique_sorties',
  libelle: 'Sorties',
  colonneNumero: { cle: 'numero', titre: 'N° de bon' },
  colonnes: [
    { titre: 'N° de bon', valeur: (d) => d.numero, mono: true, largeurExcel: 18 },
    { titre: 'Date', valeur: (d) => dateHeure(d.cree_le), rendu: (d) => texteDateHeure(d.cree_le), largeurExcel: 18 },
    { titre: 'Dépôt', valeur: (d) => d.entrepot_nom, largeurExcel: 20 },
    { titre: 'Motif / affectation', valeur: (d) => d.motif, largeurExcel: 28 },
    { titre: 'Reçu par', valeur: (d) => d.recu_par, largeurExcel: 22 },
    { titre: 'Émis par', valeur: (d) => d.emis_par_nom, largeurExcel: 22 },
    { titre: 'Lignes', valeur: (d) => d.nb_lignes, droite: true, largeurExcel: 8 },
    { titre: 'Quantité', valeur: (d) => d.quantite_totale, droite: true, largeurExcel: 10 },
    {
      titre: 'Réintégré',
      valeur: (d) => d.quantite_reintegree,
      droite: true,
      rendu: (d) => (d.quantite_reintegree > 0 ? <span className="text-warn-deep font-semibold">{d.quantite_reintegree}</span> : <span className="text-text-muted">0</span>),
      largeurExcel: 10,
    },
  ],
  lignes: {
    vue: 'v_historique_sorties_lignes',
    colonneLien: 'bon_sortie_id',
    tri: triTournee,
    colonnes: [
      { titre: 'Localisation', valeur: (l) => l.emplacement_code, mono: true, largeurExcel: 14 },
      { titre: 'Référence', valeur: (l) => l.produit_reference, mono: true, largeurExcel: 16 },
      { titre: 'Désignation', valeur: (l) => l.produit_designation, largeurExcel: 32 },
      { titre: 'N° de série', valeur: (l) => l.numero_serie, mono: true, largeurExcel: 16 },
      { titre: 'N° de lot', valeur: (l) => l.lot, mono: true, largeurExcel: 16 },
      { titre: 'Expiration', valeur: (l) => texteDate(l.date_expiration) || null, largeurExcel: 12 },
      { titre: 'Quantité', valeur: (l) => l.quantite, droite: true, largeurExcel: 10 },
      { titre: 'Réintégré', valeur: (l) => l.quantite_reintegree, droite: true, largeurExcel: 10 },
    ],
  },
  titreDetail: (d) => `Bon de sortie ${d.numero}`,
  exportPdf: ouvrirBonSortiePdf,
}

// --- Entrées (réceptions) ----------------------------------------------------

const STATUTS_RECEPTION: Record<string, { label: string; ton: TonBadge }> = {
  en_attente: { label: 'En attente', ton: 'neutre' },
  validee: { label: 'Validée', ton: 'succes' },
  partielle: { label: 'Partielle', ton: 'info' },
  anomalie: { label: 'Anomalie', ton: 'danger' },
}

export const CONFIG_ENTREES: ConfigDocuments<DocumentHistorique, DocumentHistorique> = {
  vue: 'v_historique_entrees',
  libelle: 'Entrées',
  colonneNumero: { cle: 'numero', titre: 'N° de réception' },
  colonnes: [
    { titre: 'N° de réception', valeur: (d) => txt(d.numero), mono: true, largeurExcel: 18 },
    { titre: 'Date', valeur: (d) => dateHeure(d.cree_le), rendu: (d) => texteDateHeure(d.cree_le), largeurExcel: 18 },
    { titre: 'Dépôt', valeur: (d) => txt(d.entrepot_nom), largeurExcel: 20 },
    { titre: 'Fournisseur', valeur: (d) => txt(d.fournisseur_nom), largeurExcel: 22 },
    { titre: 'N° PO', valeur: (d) => txt(d.numero_po), mono: true, largeurExcel: 14 },
    {
      titre: 'Statut',
      valeur: (d) => STATUTS_RECEPTION[String(d.statut)]?.label ?? txt(d.statut),
      rendu: (d) => {
        const s = STATUTS_RECEPTION[String(d.statut)]
        return s ? <Badge ton={s.ton}>{s.label}</Badge> : String(d.statut)
      },
      largeurExcel: 12,
    },
    { titre: 'Enregistré par', valeur: (d) => txt(d.cree_par_nom), largeurExcel: 22 },
    { titre: 'Validé par', valeur: (d) => txt(d.valide_par_nom), largeurExcel: 22 },
    { titre: 'Lignes', valeur: (d) => nb(d.nb_lignes), droite: true, largeurExcel: 8 },
    { titre: 'Qté reçue', valeur: (d) => nb(d.quantite_recue), droite: true, largeurExcel: 10 },
  ],
  lignes: {
    vue: 'v_historique_entrees_lignes',
    colonneLien: 'reception_id',
    colonnes: [
      { titre: 'Référence', valeur: (l) => txt(l.produit_reference), mono: true, largeurExcel: 16 },
      { titre: 'Désignation', valeur: (l) => txt(l.produit_designation), largeurExcel: 32 },
      { titre: 'Localisation', valeur: (l) => txt(l.emplacement_code), mono: true, largeurExcel: 14 },
      { titre: 'N° de lot', valeur: (l) => txt(l.lot), mono: true, largeurExcel: 16 },
      { titre: 'N° de série', valeur: (l) => txt(l.numero_serie), mono: true, largeurExcel: 16 },
      { titre: 'Expiration', valeur: (l) => texteDate(l.date_expiration) || null, largeurExcel: 12 },
      { titre: 'Commandé', valeur: (l) => nb(l.quantite_attendue), droite: true, largeurExcel: 10 },
      { titre: 'Reçu', valeur: (l) => nb(l.quantite_recue), droite: true, largeurExcel: 10 },
      {
        titre: 'Anomalie',
        valeur: (l) => (l.anomalie ? 'Oui' : null),
        rendu: (l) => (l.anomalie ? <Badge ton="danger">Oui</Badge> : null),
        largeurExcel: 10,
      },
    ],
  },
  titreDetail: (d) => `Réception ${String(d.numero)}`,
}

// --- Réintégrations ----------------------------------------------------------

export const CONFIG_REINTEGRATIONS: ConfigDocuments<DocumentHistorique, DocumentHistorique> = {
  vue: 'v_historique_reintegrations',
  libelle: 'Réintégrations',
  colonneNumero: { cle: 'numero', titre: 'N° de réintégration' },
  colonnes: [
    { titre: 'N° de réintégration', valeur: (d) => txt(d.numero), mono: true, largeurExcel: 20 },
    { titre: 'Date', valeur: (d) => dateHeure(d.cree_le), rendu: (d) => texteDateHeure(d.cree_le), largeurExcel: 18 },
    { titre: 'Dépôt', valeur: (d) => txt(d.entrepot_nom), largeurExcel: 20 },
    { titre: 'Notes', valeur: (d) => txt(d.notes), largeurExcel: 30 },
    { titre: 'Émis par', valeur: (d) => txt(d.emis_par_nom), largeurExcel: 22 },
    { titre: 'Lignes', valeur: (d) => nb(d.nb_lignes), droite: true, largeurExcel: 8 },
    { titre: 'Quantité', valeur: (d) => nb(d.quantite_totale), droite: true, largeurExcel: 10 },
  ],
  lignes: {
    vue: 'v_historique_reintegrations_lignes',
    colonneLien: 'reintegration_id',
    colonnes: [
      { titre: 'Bon de sortie', valeur: (l) => txt(l.bon_sortie_numero), mono: true, largeurExcel: 18 },
      { titre: 'Référence', valeur: (l) => txt(l.produit_reference), mono: true, largeurExcel: 16 },
      { titre: 'Désignation', valeur: (l) => txt(l.produit_designation), largeurExcel: 32 },
      { titre: 'Localisation de retour', valeur: (l) => txt(l.emplacement_code), mono: true, largeurExcel: 16 },
      { titre: 'N° de lot', valeur: (l) => txt(l.lot), mono: true, largeurExcel: 16 },
      { titre: 'N° de série', valeur: (l) => txt(l.numero_serie), mono: true, largeurExcel: 16 },
      { titre: 'Quantité', valeur: (l) => nb(l.quantite), droite: true, largeurExcel: 10 },
      { titre: 'Notes', valeur: (l) => txt(l.notes), largeurExcel: 24 },
    ],
  },
  titreDetail: (d) => `Réintégration ${String(d.numero)}`,
}

// --- Commandes fournisseurs (PO) -------------------------------------------------

export const CONFIG_COMMANDES: ConfigDocuments<DocumentHistorique, DocumentHistorique> = {
  vue: 'v_commandes_fournisseurs',
  libelle: 'Commandes',
  colonneNumero: { cle: 'numero', titre: 'N° PO' },
  colonnes: [
    { titre: 'N° PO', valeur: (d) => txt(d.numero), mono: true, largeurExcel: 16 },
    { titre: 'Date', valeur: (d) => dateHeure(d.cree_le), rendu: (d) => texteDateHeure(d.cree_le), largeurExcel: 18 },
    { titre: 'Fournisseur', valeur: (d) => txt(d.fournisseur_nom), largeurExcel: 26 },
    { titre: 'Dépôt de livraison', valeur: (d) => txt(d.entrepot_nom), largeurExcel: 20 },
    {
      titre: 'Statut',
      valeur: (d) => STATUTS_COMMANDE[d.statut as StatutCommande]?.label ?? txt(d.statut),
      rendu: (d) => {
        const s = STATUTS_COMMANDE[d.statut as StatutCommande]
        return s ? <Badge ton={s.ton}>{s.label}</Badge> : String(d.statut)
      },
      largeurExcel: 20,
    },
    { titre: 'Émis par', valeur: (d) => txt(d.cree_par_nom), largeurExcel: 20 },
    { titre: 'Livraison prévue', valeur: (d) => texteDate(d.date_livraison_prevue) || null, largeurExcel: 14 },
    { titre: 'Qté commandée', valeur: (d) => nb(d.quantite_commandee), droite: true, largeurExcel: 12 },
    { titre: 'Qté reçue', valeur: (d) => nb(d.quantite_recue), droite: true, largeurExcel: 10 },
    { titre: 'Montant', valeur: (d) => (d.montant == null ? null : Number(d.montant)), droite: true, largeurExcel: 14 },
    { titre: 'Motif de clôture', valeur: (d) => txt(d.motif_cloture), largeurExcel: 28 },
  ],
  lignes: {
    vue: 'v_commandes_fournisseurs_lignes',
    colonneLien: 'commande_id',
    colonnes: [
      { titre: 'Référence', valeur: (l) => txt(l.produit_reference), mono: true, largeurExcel: 16 },
      { titre: 'Désignation', valeur: (l) => txt(l.produit_designation), largeurExcel: 32 },
      { titre: 'Qté commandée', valeur: (l) => nb(l.quantite_commandee), droite: true, largeurExcel: 12 },
      { titre: 'Qté reçue', valeur: (l) => nb(l.quantite_recue), droite: true, largeurExcel: 10 },
      { titre: 'Reste', valeur: (l) => nb(l.quantite_restante), droite: true, largeurExcel: 8 },
      { titre: 'Prix unit.', valeur: (l) => (l.prix_unitaire == null ? null : Number(l.prix_unitaire)), droite: true, largeurExcel: 12 },
      { titre: 'Montant', valeur: (l) => (l.montant == null ? null : Number(l.montant)), droite: true, largeurExcel: 14 },
    ],
  },
  titreDetail: (d) => `Commande ${String(d.numero)} · ${String(d.fournisseur_nom)}`,
}

// --- Transferts ---------------------------------------------------------------

const STATUTS_TRANSFERT: Record<string, { label: string; ton: TonBadge }> = {
  demande: { label: 'Demandé', ton: 'neutre' },
  valide: { label: 'Validé', ton: 'info' },
  expedie: { label: 'Expédié', ton: 'info' },
  en_transit: { label: 'En transit', ton: 'info' },
  recu: { label: 'Reçu', ton: 'succes' },
}

export const CONFIG_TRANSFERTS: ConfigDocuments<DocumentHistorique, DocumentHistorique> = {
  vue: 'v_historique_transferts',
  libelle: 'Transferts',
  colonneNumero: { cle: 'numero', titre: 'N° de suivi' },
  colonnes: [
    { titre: 'N° de suivi', valeur: (d) => txt(d.numero), mono: true, largeurExcel: 18 },
    { titre: 'Date', valeur: (d) => dateHeure(d.cree_le), rendu: (d) => texteDateHeure(d.cree_le), largeurExcel: 18 },
    { titre: 'Source', valeur: (d) => txt(d.entrepot_source_nom), largeurExcel: 20 },
    { titre: 'Destination', valeur: (d) => txt(d.entrepot_destination_nom), largeurExcel: 20 },
    {
      titre: 'Statut',
      valeur: (d) => STATUTS_TRANSFERT[String(d.statut)]?.label ?? txt(d.statut),
      rendu: (d) => {
        const s = STATUTS_TRANSFERT[String(d.statut)]
        return s ? <Badge ton={s.ton}>{s.label}</Badge> : String(d.statut)
      },
      largeurExcel: 12,
    },
    { titre: 'Demandé par', valeur: (d) => txt(d.emis_par_nom), largeurExcel: 22 },
    { titre: 'Expédié le', valeur: (d) => dateHeure(d.expedie_le), rendu: (d) => (d.expedie_le ? texteDateHeure(d.expedie_le) : null), largeurExcel: 18 },
    { titre: 'Reçu le', valeur: (d) => dateHeure(d.recu_le), rendu: (d) => (d.recu_le ? texteDateHeure(d.recu_le) : null), largeurExcel: 18 },
    { titre: 'Qté expédiée', valeur: (d) => nb(d.quantite_expediee), droite: true, largeurExcel: 12 },
    { titre: 'Qté reçue', valeur: (d) => nb(d.quantite_recue), droite: true, largeurExcel: 10 },
  ],
  lignes: {
    vue: 'v_historique_transferts_lignes',
    colonneLien: 'transfert_id',
    colonnes: [
      { titre: 'Référence', valeur: (l) => txt(l.produit_reference), mono: true, largeurExcel: 16 },
      { titre: 'Désignation', valeur: (l) => txt(l.produit_designation), largeurExcel: 32 },
      { titre: 'Emplacement source', valeur: (l) => txt(l.emplacement_source_code), mono: true, largeurExcel: 16 },
      { titre: 'Emplacement destination', valeur: (l) => txt(l.emplacement_destination_code), mono: true, largeurExcel: 18 },
      { titre: 'Qté expédiée', valeur: (l) => nb(l.quantite_expediee), droite: true, largeurExcel: 12 },
      { titre: 'Qté reçue', valeur: (l) => nb(l.quantite_recue), droite: true, largeurExcel: 10 },
    ],
  },
  titreDetail: (d) => `Transfert ${String(d.numero)}`,
}

// --- Non-conformités (quarantaine) --------------------------------------------

export const CONFIG_NON_CONFORMITES: ConfigDocuments<DocumentHistorique, DocumentHistorique> = {
  vue: 'v_quarantaine',
  libelle: 'Non-conformités',
  colonneNumero: { cle: 'numero', titre: 'N° NC' },
  colonnes: [
    { titre: 'N° NC', valeur: (d) => txt(d.numero), mono: true, largeurExcel: 16 },
    { titre: 'Date', valeur: (d) => dateHeure(d.cree_le), rendu: (d) => texteDateHeure(d.cree_le), largeurExcel: 18 },
    {
      titre: 'Statut',
      valeur: (d) => STATUTS_NC[d.statut as StatutNc]?.label ?? txt(d.statut),
      rendu: (d) => {
        const s = STATUTS_NC[d.statut as StatutNc]
        return s ? <Badge ton={s.ton}>{s.label}</Badge> : String(d.statut)
      },
      largeurExcel: 14,
    },
    { titre: 'Référence', valeur: (d) => txt(d.produit_reference), mono: true, largeurExcel: 16 },
    { titre: 'Désignation', valeur: (d) => txt(d.produit_designation), largeurExcel: 30 },
    { titre: 'Lot / Série', valeur: (d) => txt(d.lot ?? d.numero_serie), mono: true, largeurExcel: 14 },
    { titre: 'Motif', valeur: (d) => libelleMotif(txt(d.motif)), largeurExcel: 24 },
    { titre: 'Fournisseur', valeur: (d) => txt(d.fournisseur_nom), largeurExcel: 22 },
    { titre: 'N° commande', valeur: (d) => txt(d.numero_po), mono: true, largeurExcel: 14 },
    { titre: 'Réception', valeur: (d) => txt(d.reception_numero), mono: true, largeurExcel: 16 },
    { titre: 'Origine', valeur: (d) => ORIGINES_NC[String(d.origine)] ?? txt(d.origine), largeurExcel: 18 },
    { titre: 'Qté initiale', valeur: (d) => nb(d.quantite_initiale), droite: true, largeurExcel: 10 },
    { titre: 'Qté restante', valeur: (d) => nb(d.quantite_restante), droite: true, largeurExcel: 10 },
    { titre: 'Déclaré par', valeur: (d) => txt(d.declare_par_nom), largeurExcel: 22 },
  ],
  lignes: {
    vue: 'v_quarantaine_traitements',
    colonneLien: 'non_conformite_id',
    colonnes: [
      { titre: 'Date', valeur: (l) => dateHeure(l.cree_le), rendu: (l) => texteDateHeure(l.cree_le), largeurExcel: 18 },
      { titre: 'Décision', valeur: (l) => libelleDecision(String(l.decision)), largeurExcel: 20 },
      { titre: 'Prise sur', valeur: (l) => (l.source === 'reparation' ? 'Retour de réparation' : 'À traiter'), largeurExcel: 18 },
      { titre: 'Quantité', valeur: (l) => nb(l.quantite), droite: true, largeurExcel: 10 },
      { titre: 'Destination', valeur: (l) => txt(l.emplacement_destination_code), mono: true, largeurExcel: 14 },
      { titre: 'Document', valeur: (l) => txt(l.reference_document), mono: true, largeurExcel: 18 },
      { titre: 'Commentaire', valeur: (l) => txt(l.commentaire), largeurExcel: 40 },
      { titre: 'Traité par', valeur: (l) => txt(l.traite_par_nom), largeurExcel: 22 },
    ],
  },
  titreDetail: (d) => `Dossier ${String(d.numero)}`,
}

// --- Tous les mouvements ------------------------------------------------------

const TYPES_MOUVEMENT: Record<string, { label: string; ton: TonBadge }> = {
  entree: { label: 'Entrée', ton: 'succes' },
  sortie: { label: 'Sortie', ton: 'danger' },
  transfert: { label: 'Transfert', ton: 'neutre' },
  ajustement: { label: 'Ajustement', ton: 'alerte' },
  inventaire: { label: 'Inventaire', ton: 'alerte' },
  deplacement: { label: 'Déplacement', ton: 'neutre' },
  reintegration: { label: 'Réintégration', ton: 'succes' },
}

export const CONFIG_MOUVEMENTS: ConfigDocuments<DocumentHistorique, never> = {
  vue: 'v_historique_mouvements',
  libelle: 'Mouvements',
  colonneNumero: { cle: 'reference', titre: 'Document' },
  colonnes: [
    { titre: 'Date', valeur: (d) => dateHeure(d.cree_le), rendu: (d) => texteDateHeure(d.cree_le), largeurExcel: 18 },
    {
      titre: 'Type',
      valeur: (d) => TYPES_MOUVEMENT[String(d.type)]?.label ?? txt(d.type),
      rendu: (d) => {
        const t = TYPES_MOUVEMENT[String(d.type)]
        return t ? <Badge ton={t.ton}>{t.label}</Badge> : String(d.type)
      },
      largeurExcel: 14,
    },
    { titre: 'Document', valeur: (d) => txt(d.reference), mono: true, largeurExcel: 18 },
    { titre: 'Référence', valeur: (d) => txt(d.produit_reference), mono: true, largeurExcel: 16 },
    { titre: 'Désignation', valeur: (d) => txt(d.produit_designation), largeurExcel: 30 },
    { titre: 'Dépôt', valeur: (d) => txt(d.entrepot_nom), largeurExcel: 18 },
    {
      titre: 'Localisation',
      valeur: (d) => (d.emplacement_origine_code ? `${String(d.emplacement_origine_code)} → ${String(d.emplacement_code ?? '')}` : txt(d.emplacement_code)),
      mono: true,
      largeurExcel: 16,
    },
    { titre: 'Lot / N° série', valeur: (d) => txt(d.lot ?? d.numero_serie), mono: true, largeurExcel: 16 },
    { titre: 'Quantité', valeur: (d) => nb(d.quantite), droite: true, largeurExcel: 10 },
    { titre: 'Stock avant', valeur: (d) => nb(d.stock_avant), droite: true, largeurExcel: 10 },
    { titre: 'Stock après', valeur: (d) => nb(d.stock_apres), droite: true, largeurExcel: 10 },
    { titre: 'Motif', valeur: (d) => txt(d.motif), largeurExcel: 24 },
    { titre: 'Opérateur', valeur: (d) => txt(d.utilisateur_nom), largeurExcel: 22 },
  ],
}

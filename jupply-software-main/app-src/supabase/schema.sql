-- Schema Jupply Software - V1 complete, aligne sur le cahier des charges
-- (docs/CAHIER_DES_CHARGES.md et docs/GLOSSAIRE.md a la racine du depot).
-- A coller dans Supabase : Project > SQL Editor > New query > Run.
--
-- ATTENTION : ce script repart d'une base propre. Si un schema precedent
-- existe deja (version minimale avec la table "articles"), supprime-le
-- d'abord :
--   drop schema public cascade;
--   create schema public;
-- (cela efface aussi les donnees de demo - sans impact ici, il n'y a pas
-- encore d'utilisateur reel sur l'application).

-- ============================================================
-- 1. TABLES
-- ============================================================

-- 1.1 Entreprises, utilisateurs, roles et droits
-- ------------------------------------------------------------

create table entreprises (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  cree_le timestamptz not null default now()
);

-- Un profil par utilisateur connecte, lie a auth.users et a une entreprise.
-- 4 roles officiels (voir docs/GLOSSAIRE.md, section 11) : un utilisateur
-- n'a qu'un seul role, correspondant a son poste reel.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom_complet text not null,
  role text not null default 'magasinier'
    check (role in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot', 'magasinier')),
  cree_le timestamptz not null default now()
);

create table entrepots (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  adresse text,
  cree_le timestamptz not null default now()
);

-- Entrepots assignes a un Gestionnaire ou un Magasinier (droit standard de
-- son role). L'Administrateur et le Superviseur Entrepot voient tout sans
-- avoir besoin d'etre assignes.
create table profils_entrepots (
  profile_id uuid not null references profiles(id) on delete cascade,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  primary key (profile_id, entrepot_id)
);

-- Droit supplementaire accorde ponctuellement a un utilisateur, au-dela de
-- son role standard (ex. acces temporaire a un second entrepot), avec date
-- d'expiration optionnelle.
create table privileges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  accorde_par uuid not null references profiles(id),
  motif text,
  date_expiration timestamptz,
  cree_le timestamptz not null default now()
);

-- Historique de toute attribution/retrait de droit ou de privilege.
create table journal_droits (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  entrepot_id uuid references entrepots(id) on delete set null,
  type_action text not null check (type_action in ('attribution', 'retrait')),
  accorde_par uuid not null references profiles(id),
  motif text,
  cree_le timestamptz not null default now()
);

-- 1.2 Localisation
-- ------------------------------------------------------------
-- Localisation complete = Entrepot + Zone + Rayon + Etagere + Emplacement.
-- Zone/rayon/etagere sont des colonnes texte libres sur l'emplacement
-- plutot que des tables separees, pour rester simple en V1 (voir PLAN.md,
-- "Points de vigilance"). Chaque entrepot recoit automatiquement un
-- emplacement Quarantaine a sa creation (voir section 2, trigger).
create table emplacements (
  id uuid primary key default gen_random_uuid(),
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  zone text,
  rayon text,
  etagere text,
  code text not null,
  est_quarantaine boolean not null default false,
  cree_le timestamptz not null default now()
);

-- 1.3 Produits
-- ------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null
);

create table fournisseurs (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  contact text,
  telephone text,
  email text,
  adresse text,
  ville text,
  pays text,
  cree_le timestamptz not null default now()
);

-- Regroupe des produits a reference distincte qui sont des variantes d'un
-- meme modele (ex. T-shirt en tailles S/M/L/XL, chacune suivie separement).
create table groupes_variantes (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null
);

create table produits (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  reference text not null,
  designation text not null,
  categorie_id uuid references categories(id) on delete set null,
  -- Consommable : sortie definitive. Outillage : prete a une personne/service
  -- puis retourne (voir affectations_outillage). Rotable : piece reparable,
  -- envoyee en reparation puis remise en stock (workflow de reparation pas
  -- encore construit).
  type text not null default 'consommable' check (type in ('consommable', 'outillage', 'rotable')),
  unite_mesure text not null default 'piece',
  -- Recalcule a chaque reception validee (Prix Moyen Pondere, methode
  -- SYSCOHADA retenue pour JUPPLY). A 0 tant qu'aucune reception n'existe.
  prix_moyen_pondere numeric(14, 2) not null default 0,
  stock_min integer not null default 0,
  stock_max integer,
  seuil_reappro integer,
  gere_lot boolean not null default false,
  gere_numero_serie boolean not null default false,
  gere_expiration boolean not null default false,
  groupe_variante_id uuid references groupes_variantes(id) on delete set null,
  valeur_variante text,
  cree_le timestamptz not null default now(),
  unique (entreprise_id, reference)
);

create table produits_fournisseurs (
  produit_id uuid not null references produits(id) on delete cascade,
  fournisseur_id uuid not null references fournisseurs(id) on delete cascade,
  reference_fournisseur text,
  primary key (produit_id, fournisseur_id)
);

-- Produits consideres comme repondant au meme besoin, sans addition des
-- quantites (ex. deux references de filtre interchangeables).
create table produits_equivalents (
  produit_id uuid not null references produits(id) on delete cascade,
  produit_equivalent_id uuid not null references produits(id) on delete cascade,
  primary key (produit_id, produit_equivalent_id),
  check (produit_id <> produit_equivalent_id)
);

-- 1.4 Stock et mouvements
-- ------------------------------------------------------------

-- Quantite d'un produit a un emplacement precis. Un meme produit peut
-- avoir plusieurs lignes dans un meme entrepot (plusieurs emplacements).
create table stock_produits (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references produits(id) on delete cascade,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  emplacement_id uuid not null references emplacements(id) on delete cascade,
  quantite integer not null default 0,
  unique (produit_id, entrepot_id, emplacement_id)
);

-- Stock restant par lot. La somme des lots d'un (produit, entrepot,
-- emplacement) est toujours egale a stock_produits.quantite.
create table stock_lots (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references produits(id) on delete cascade,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  emplacement_id uuid not null references emplacements(id) on delete cascade,
  lot text,
  numero_serie text,
  date_expiration date,
  -- Date d'entree en stock : sert au FIFO.
  date_entree timestamptz not null default now(),
  prix_unitaire numeric(14, 2),
  quantite integer not null check (quantite > 0)
);

create index on stock_lots (produit_id, entrepot_id, emplacement_id);

-- Tampon interne : lots retires d'un emplacement pendant une transaction,
-- pour les reposer a l'identique si le meme produit est remis ailleurs dans
-- la meme transaction (deplacement interne). Volontairement sans cle
-- etrangere : il est ecrit depuis un trigger, y compris pendant une
-- suppression en cascade.
create table lots_en_mouvement (
  id uuid primary key default gen_random_uuid(),
  transaction_id bigint not null default txid_current(),
  produit_id uuid not null,
  entrepot_id uuid not null,
  lot text,
  numero_serie text,
  date_expiration date,
  date_entree timestamptz not null,
  prix_unitaire numeric(14, 2),
  quantite integer not null check (quantite > 0)
);

create table mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  emplacement_id uuid references emplacements(id) on delete set null,
  -- Renseigne uniquement pour type = 'deplacement' : emplacement de depart,
  -- emplacement_id ci-dessus jouant alors le role de destination.
  emplacement_origine_id uuid references emplacements(id) on delete set null,
  type text not null check (type in ('entree', 'sortie', 'transfert', 'ajustement', 'inventaire', 'deplacement', 'reintegration')),
  quantite integer not null check (quantite > 0),
  stock_avant integer not null,
  stock_apres integer not null,
  utilisateur_id uuid not null references profiles(id),
  reference text not null,
  motif text,
  lot text,
  numero_serie text,
  prix_unitaire numeric(14, 2),
  cree_le timestamptz not null default now()
);

-- 1.5 Commandes fournisseurs (PO) et receptions (entrees)
-- ------------------------------------------------------------
-- Bon de commande PO-<annee>-<sequence>. Statuts : fait -> envoye ->
-- en_transit -> en_cours_reception -> completee ; cloturee (cloture
-- manuelle avec motif). Voir receptionner_commande.
create sequence commandes_fournisseurs_numero_seq;

create table commandes_fournisseurs (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  numero text not null,
  fournisseur_id uuid not null references fournisseurs(id),
  -- Depot de livraison.
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  statut text not null default 'fait'
    check (statut in ('fait', 'envoye', 'en_transit', 'en_cours_reception', 'completee', 'cloturee')),
  date_commande date not null default current_date,
  date_livraison_prevue date,
  notes text,
  motif_cloture text,
  cree_par uuid references profiles(id) on delete set null,
  cree_le timestamptz not null default now(),
  envoye_le timestamptz,
  transit_le timestamptz,
  completee_le timestamptz,
  cloturee_le timestamptz,
  cloturee_par uuid references profiles(id) on delete set null,
  unique (entreprise_id, numero)
);

create index commandes_fournisseurs_entrepot_statut_idx on commandes_fournisseurs (entrepot_id, statut);

create table commandes_fournisseurs_lignes (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes_fournisseurs(id) on delete cascade,
  produit_id uuid not null references produits(id),
  quantite_commandee integer not null check (quantite_commandee > 0),
  prix_unitaire numeric(14, 2) not null default 0,
  -- Cumul de tout ce qui a ete livre (y compris la part mise en quarantaine).
  quantite_recue integer not null default 0 check (quantite_recue >= 0)
);

create index commandes_fournisseurs_lignes_commande_idx on commandes_fournisseurs_lignes (commande_id);

-- ------------------------------------------------------------

create table receptions (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  numero text not null,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  fournisseur_id uuid references fournisseurs(id) on delete set null,
  numero_po text,
  -- Commande fournisseur d'origine (null pour une entree manuelle).
  commande_id uuid references commandes_fournisseurs(id) on delete set null,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'validee', 'partielle', 'anomalie', 'annulee')),
  cree_par uuid not null references profiles(id),
  valide_par uuid references profiles(id),
  valide_le timestamptz,
  -- Annulation d'une entree en attente (aucun effet sur le stock).
  annulee_par uuid references profiles(id),
  annulee_le timestamptz,
  motif_annulation text,
  notes text,
  cree_le timestamptz not null default now(),
  unique (entreprise_id, numero)
);

create table receptions_lignes (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references receptions(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  emplacement_id uuid references emplacements(id) on delete set null,
  quantite_attendue integer not null default 0,
  quantite_recue integer not null default 0,
  lot text,
  numero_serie text,
  date_expiration date,
  prix_unitaire numeric(14, 2) not null default 0,
  anomalie boolean not null default false,
  -- Non-conformite declaree par l'operateur (seule cette quantite part en quarantaine).
  quantite_non_conforme integer not null default 0,
  motif_non_conformite text,
  constat_non_conformite text,
  commande_ligne_id uuid references commandes_fournisseurs_lignes(id) on delete set null,
  cree_le timestamptz not null default now()
);

-- Dossiers de non-conformite (quarantaine) et leurs traitements.
create sequence non_conformites_numero_seq;

create table non_conformites (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  numero text not null,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  -- Emplacement Quarantaine de l'entrepot ou se trouve le produit.
  emplacement_id uuid not null references emplacements(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  lot text,
  numero_serie text,
  date_expiration date,
  date_entree_lot timestamptz,
  prix_unitaire numeric(14, 2),
  origine text not null check (origine in ('reception', 'stock', 'reprise')),
  reception_id uuid references receptions(id) on delete set null,
  fournisseur_id uuid references fournisseurs(id) on delete set null,
  numero_po text,
  motif text not null check (motif in (
    'endommage', 'avarie_transport', 'non_conforme_commande', 'surplus',
    'perime', 'documents_manquants', 'defaut_qualite', 'autre'
  )),
  constat text,
  quantite_initiale integer not null check (quantite_initiale > 0),
  -- Quantite encore physiquement en quarantaine (a traiter + en reparation).
  quantite_restante integer not null check (quantite_restante >= 0),
  quantite_en_reparation integer not null default 0 check (quantite_en_reparation >= 0),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'en_cours', 'en_reparation', 'cloturee')),
  declare_par uuid references profiles(id) on delete set null,
  cree_le timestamptz not null default now(),
  cloture_le timestamptz,
  unique (entreprise_id, numero),
  check (quantite_en_reparation <= quantite_restante and quantite_restante <= quantite_initiale)
);

create index on non_conformites (entrepot_id, statut);

create table non_conformites_traitements (
  id uuid primary key default gen_random_uuid(),
  non_conformite_id uuid not null references non_conformites(id) on delete cascade,
  decision text not null check (decision in ('liberation', 'retour_fournisseur', 'rebut', 'reparation')),
  -- Quantite prise dans la part "a traiter" ou dans la part "en reparation".
  source text not null default 'a_traiter' check (source in ('a_traiter', 'reparation')),
  quantite integer not null check (quantite > 0),
  emplacement_destination_id uuid references emplacements(id) on delete set null,
  -- N° de retour / avoir, de PV de destruction, d'ordre de reparation...
  reference_document text,
  commentaire text not null,
  traite_par uuid not null references profiles(id),
  cree_le timestamptz not null default now()
);

create index on non_conformites_traitements (non_conformite_id);

-- Numerotation des receptions (REC-<annee>-<sequence>), atomique meme en
-- cas de creations simultanees.
create sequence receptions_numero_seq;

-- 1.6 Sorties
-- ------------------------------------------------------------

create table bons_sortie (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  numero text not null,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  demande_par uuid not null references profiles(id),
  statut text not null default 'demandee' check (statut in ('demandee', 'confirmee', 'annulee')),
  -- Motif / affectation (imprime dans le bloc de titre du bon).
  motif text,
  -- Personne qui recoit la sortie (cadre "Recu par / Given to" du bon).
  recu_par text,
  cree_le timestamptz not null default now(),
  unique (entreprise_id, numero)
);

create table bons_sortie_lignes (
  id uuid primary key default gen_random_uuid(),
  bon_sortie_id uuid not null references bons_sortie(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  emplacement_id uuid references emplacements(id) on delete set null,
  quantite integer not null check (quantite > 0),
  -- Lot sorti (affichage du bon + retour dans le lot d'origine a la reintegration).
  lot text,
  numero_serie text,
  date_expiration date,
  date_entree_lot timestamptz
);

-- Reintegration : annule tout ou partie d'une sortie deja confirmee, ligne
-- de sortie par ligne de sortie (une reintegration cible precisement une
-- bons_sortie_lignes et ne peut pas depasser son solde restant), voir vue
-- v_sorties_a_reintegrer.
create table reintegrations (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  numero text not null,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  demande_par uuid not null references profiles(id),
  notes text,
  cree_le timestamptz not null default now(),
  unique (entreprise_id, numero)
);

create table reintegrations_lignes (
  id uuid primary key default gen_random_uuid(),
  reintegration_id uuid not null references reintegrations(id) on delete cascade,
  bon_sortie_ligne_id uuid not null references bons_sortie_lignes(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  emplacement_id uuid not null references emplacements(id) on delete cascade,
  quantite integer not null check (quantite > 0),
  notes text
);

create sequence bons_sortie_numero_seq;
create sequence reintegrations_numero_seq;

-- 1.7 Transferts entre entrepots
-- ------------------------------------------------------------

create table transferts (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  numero_suivi text not null,
  entrepot_source_id uuid not null references entrepots(id),
  entrepot_destination_id uuid not null references entrepots(id),
  statut text not null default 'demande'
    check (statut in ('demande', 'valide', 'expedie', 'en_transit', 'recu')),
  demande_par uuid not null references profiles(id),
  valide_par uuid references profiles(id),
  cree_le timestamptz not null default now(),
  expedie_le timestamptz,
  recu_le timestamptz,
  unique (entreprise_id, numero_suivi),
  check (entrepot_source_id <> entrepot_destination_id)
);

create table transferts_lignes (
  id uuid primary key default gen_random_uuid(),
  transfert_id uuid not null references transferts(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  quantite_expediee integer not null check (quantite_expediee > 0),
  quantite_recue integer,
  emplacement_source_id uuid references emplacements(id),
  emplacement_destination_id uuid references emplacements(id)
);

create sequence transferts_numero_seq;

-- 1.8 Inventaires
-- ------------------------------------------------------------

create table inventaires (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  type text not null check (type in ('global', 'partiel')),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'verifie')),
  demarre_par uuid not null references profiles(id),
  verifie_par uuid references profiles(id),
  cree_le timestamptz not null default now(),
  verifie_le timestamptz
);

create table inventaires_lignes (
  id uuid primary key default gen_random_uuid(),
  inventaire_id uuid not null references inventaires(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  emplacement_id uuid references emplacements(id) on delete set null,
  stock_theorique integer not null default 0,
  stock_physique integer,
  ecart integer generated always as (stock_physique - stock_theorique) stored
);

-- 1.9 Outillage
-- ------------------------------------------------------------

create table affectations_outillage (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  entrepot_id uuid not null references entrepots(id) on delete cascade,
  beneficiaire text not null,
  date_affectation date not null default current_date,
  date_retour date,
  statut text not null default 'affecte' check (statut in ('affecte', 'en_stock')),
  affecte_par uuid not null references profiles(id),
  cree_le timestamptz not null default now()
);

-- 1.10 Index
-- ------------------------------------------------------------

create index on produits (entreprise_id);
create index on mouvements_stock (entreprise_id, cree_le desc);
create index on stock_produits (entrepot_id);
create index on emplacements (entrepot_id);
create unique index emplacements_quarantaine_unique on emplacements (entrepot_id) where est_quarantaine;
create index on receptions (entreprise_id, statut);
create index on bons_sortie (entreprise_id, statut);
create index on transferts (entreprise_id, statut);
create index on inventaires (entreprise_id, statut);
create index on affectations_outillage (entreprise_id, statut);
create index on profils_entrepots (entrepot_id);
create index on privileges (profile_id);

-- ============================================================
-- 2. TRIGGER : quarantaine automatique
-- ============================================================
-- Chaque entrepot doit disposer d'un emplacement reserve "Quarantaine"
-- (cahier des charges, section 5). Cree automatiquement a la creation de
-- l'entrepot pour ne jamais l'oublier.

create function creer_emplacement_quarantaine()
returns trigger
language plpgsql
as $$
begin
  insert into emplacements (entrepot_id, code, est_quarantaine)
  values (new.id, 'Quarantaine', true);
  return new;
end;
$$;

create trigger trg_creer_quarantaine
after insert on entrepots
for each row execute function creer_emplacement_quarantaine();

-- ============================================================
-- 3. ISOLATION MULTI-ENTREPRISES ET MULTI-ENTREPOTS (RLS)
-- ============================================================
-- Chaque utilisateur ne voit que les donnees de sa propre entreprise, et
-- au sein de celle-ci, uniquement les entrepots auxquels son role lui
-- donne acces (Administrateur et Superviseur Entrepot : tous ; Gestionnaire
-- et Magasinier : ceux assignes via profils_entrepots, ou accordes via un
-- privilege actif).
--
-- Note : uniquement des policies de LECTURE pour l'instant, sur le meme
-- principe que le schema precedent. Les policies d'ECRITURE (qui peut
-- creer/valider une reception, une sortie, un transfert...) seront
-- ajoutees au fur et a mesure de la construction de chaque ecran.

create function current_entreprise_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select entreprise_id from profiles where id = auth.uid()
$$;

create function role_courant()
returns text
language sql security definer stable
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create function entrepots_visibles()
returns setof uuid
language sql security definer stable
set search_path = public
as $$
  select id from entrepots
  where entreprise_id = current_entreprise_id()
    and (
      role_courant() in ('administrateur', 'superviseur_entrepot')
      or id in (select entrepot_id from profils_entrepots where profile_id = auth.uid())
      or id in (
        select entrepot_id from privileges
        where profile_id = auth.uid() and (date_expiration is null or date_expiration > now())
      )
    )
$$;

alter table entreprises enable row level security;
create policy "lecture entreprise" on entreprises
  for select using (id = current_entreprise_id());

alter table profiles enable row level security;
create policy "lecture profils entreprise" on profiles
  for select using (entreprise_id = current_entreprise_id());

alter table entrepots enable row level security;
create policy "lecture entrepots visibles" on entrepots
  for select using (entreprise_id = current_entreprise_id() and id in (select entrepots_visibles()));

-- Creation/modification : Administrateur, Superviseur Entrepot. Suppression : Administrateur seul.
create policy "creation entrepots" on entrepots
  for insert with check (
    entreprise_id = current_entreprise_id()
    and role_courant() in ('administrateur', 'superviseur_entrepot')
  );

create policy "modification entrepots" on entrepots
  for update using (
    entreprise_id = current_entreprise_id()
    and role_courant() in ('administrateur', 'superviseur_entrepot')
  )
  with check (
    entreprise_id = current_entreprise_id()
    and role_courant() in ('administrateur', 'superviseur_entrepot')
  );

create policy "suppression entrepots" on entrepots
  for delete using (
    entreprise_id = current_entreprise_id()
    and role_courant() = 'administrateur'
  );

alter table profils_entrepots enable row level security;
create policy "lecture assignations entreprise" on profils_entrepots
  for select using (profile_id in (select id from profiles where entreprise_id = current_entreprise_id()));

alter table privileges enable row level security;
create policy "lecture privileges entreprise" on privileges
  for select using (profile_id in (select id from profiles where entreprise_id = current_entreprise_id()));

alter table journal_droits enable row level security;
create policy "lecture journal droits entreprise" on journal_droits
  for select using (entreprise_id = current_entreprise_id());

alter table emplacements enable row level security;
create policy "lecture emplacements visibles" on emplacements
  for select using (entrepot_id in (select entrepots_visibles()));

-- Ajout/modification/suppression d'un emplacement : Administrateur, Superviseur Entrepot,
-- ou Gestionnaire assigne a cet entrepot. Jamais sur l'emplacement Quarantaine (cree par trigger).
create policy "creation emplacements" on emplacements
  for insert with check (
    not est_quarantaine
    and entrepot_id in (
      select id from entrepots
      where entreprise_id = current_entreprise_id()
        and (
          role_courant() in ('administrateur', 'superviseur_entrepot')
          or (
            role_courant() = 'gestionnaire_entrepot'
            and id in (select entrepot_id from profils_entrepots where profile_id = auth.uid())
          )
        )
    )
  );

create policy "modification emplacements" on emplacements
  for update using (
    not est_quarantaine
    and entrepot_id in (
      select id from entrepots
      where entreprise_id = current_entreprise_id()
        and (
          role_courant() in ('administrateur', 'superviseur_entrepot')
          or (
            role_courant() = 'gestionnaire_entrepot'
            and id in (select entrepot_id from profils_entrepots where profile_id = auth.uid())
          )
        )
    )
  );

create policy "suppression emplacements" on emplacements
  for delete using (
    not est_quarantaine
    and entrepot_id in (
      select id from entrepots
      where entreprise_id = current_entreprise_id()
        and (
          role_courant() in ('administrateur', 'superviseur_entrepot')
          or (
            role_courant() = 'gestionnaire_entrepot'
            and id in (select entrepot_id from profils_entrepots where profile_id = auth.uid())
          )
        )
    )
  );

alter table categories enable row level security;
create policy "lecture categories entreprise" on categories
  for select using (entreprise_id = current_entreprise_id());

-- Catalogue partage par toute l'entreprise (pas propre a un entrepot) :
-- Administrateur, Superviseur Entrepot, Gestionnaire d'entrepot (n'importe lequel).
create policy "creation categories" on categories
  for insert with check (
    entreprise_id = current_entreprise_id()
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  );

alter table fournisseurs enable row level security;
create policy "lecture fournisseurs entreprise" on fournisseurs
  for select using (entreprise_id = current_entreprise_id());

create policy "creation fournisseurs" on fournisseurs
  for insert with check (
    entreprise_id = current_entreprise_id()
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  );

alter table groupes_variantes enable row level security;
create policy "lecture groupes variantes entreprise" on groupes_variantes
  for select using (entreprise_id = current_entreprise_id());

alter table produits enable row level security;
create policy "lecture produits entreprise" on produits
  for select using (entreprise_id = current_entreprise_id());

create policy "creation produits" on produits
  for insert with check (
    entreprise_id = current_entreprise_id()
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  );

create policy "modification produits" on produits
  for update using (
    entreprise_id = current_entreprise_id()
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  )
  with check (
    entreprise_id = current_entreprise_id()
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  );

create policy "suppression produits" on produits
  for delete using (
    entreprise_id = current_entreprise_id()
    and role_courant() = 'administrateur'
  );

alter table produits_fournisseurs enable row level security;
create policy "lecture produits fournisseurs" on produits_fournisseurs
  for select using (produit_id in (select id from produits where entreprise_id = current_entreprise_id()));

create policy "creation produits fournisseurs" on produits_fournisseurs
  for insert with check (
    produit_id in (
      select id from produits
      where entreprise_id = current_entreprise_id()
        and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
    )
  );

create policy "suppression produits fournisseurs" on produits_fournisseurs
  for delete using (
    produit_id in (
      select id from produits
      where entreprise_id = current_entreprise_id()
        and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
    )
  );

alter table produits_equivalents enable row level security;
create policy "lecture produits equivalents" on produits_equivalents
  for select using (produit_id in (select id from produits where entreprise_id = current_entreprise_id()));

create policy "creation produits equivalents" on produits_equivalents
  for insert with check (
    produit_id in (
      select id from produits
      where entreprise_id = current_entreprise_id()
        and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
    )
  );

create policy "suppression produits equivalents" on produits_equivalents
  for delete using (
    produit_id in (
      select id from produits
      where entreprise_id = current_entreprise_id()
        and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
    )
  );

alter table stock_produits enable row level security;
create policy "lecture stock visible" on stock_produits
  for select using (entrepot_id in (select entrepots_visibles()));

-- Ecriture du stock (placement/deplacement) : quiconque voit l'entrepot
-- peut y agir, y compris le Magasinier (saisie quotidienne fait partie de
-- son role standard, a la difference de la gestion des emplacements eux-memes).
create policy "creation stock" on stock_produits
  for insert with check (entrepot_id in (select entrepots_visibles()));

create policy "modification stock" on stock_produits
  for update using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

create policy "suppression stock" on stock_produits
  for delete using (entrepot_id in (select entrepots_visibles()));

-- Lots : memes regles que stock_produits (une seule policy "for all", qui
-- couvre aussi les verrous "for update" poses par les fonctions).
alter table stock_lots enable row level security;
create policy "acces lots visibles" on stock_lots
  for all
  using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

alter table lots_en_mouvement enable row level security;
create policy "acces lots en mouvement visibles" on lots_en_mouvement
  for all
  using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

-- Quarantaine : memes regles (une policy "for all", qui couvre aussi les verrous).
alter table non_conformites enable row level security;
create policy "acces non conformites visibles" on non_conformites
  for all
  using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

alter table non_conformites_traitements enable row level security;
create policy "acces traitements non conformites visibles" on non_conformites_traitements
  for all
  using (non_conformite_id in (select id from non_conformites where entrepot_id in (select entrepots_visibles())))
  with check (non_conformite_id in (select id from non_conformites where entrepot_id in (select entrepots_visibles())));

alter table mouvements_stock enable row level security;
create policy "lecture mouvements visibles" on mouvements_stock
  for select using (entrepot_id in (select entrepots_visibles()));

-- Un utilisateur ne peut journaliser un mouvement qu'en son propre nom.
create policy "creation mouvements" on mouvements_stock
  for insert with check (
    entrepot_id in (select entrepots_visibles())
    and utilisateur_id = auth.uid()
  );

alter table receptions enable row level security;
create policy "lecture receptions visibles" on receptions
  for select using (entrepot_id in (select entrepots_visibles()));

-- Saisie : tous les roles operationnels (y compris Magasinier) sur leurs
-- entrepots visibles. Validation (update) : Administrateur, Superviseur
-- Entrepot, Gestionnaire d'entrepot uniquement (pas le Magasinier).
create policy "creation receptions" on receptions
  for insert with check (entrepot_id in (select entrepots_visibles()));

create policy "validation receptions" on receptions
  for update using (
    entrepot_id in (select entrepots_visibles())
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  )
  with check (
    entrepot_id in (select entrepots_visibles())
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  );

alter table receptions_lignes enable row level security;
create policy "lecture receptions lignes visibles" on receptions_lignes
  for select using (reception_id in (select id from receptions where entrepot_id in (select entrepots_visibles())));

create policy "creation receptions lignes" on receptions_lignes
  for insert with check (
    reception_id in (select id from receptions where entrepot_id in (select entrepots_visibles()))
  );

-- L'auteur d'une entree en attente peut l'annuler ou la modifier (les roles
-- de validation le peuvent deja via "validation receptions"). Il ne peut pas
-- la passer en validee : seuls les statuts en_attente / annulee sont permis.
create policy "modification receptions en attente par l'auteur" on receptions
  for update using (
    entrepot_id in (select entrepots_visibles()) and cree_par = auth.uid() and statut = 'en_attente'
  )
  with check (
    entrepot_id in (select entrepots_visibles()) and cree_par = auth.uid() and statut in ('en_attente', 'annulee')
  );

-- Remplacement des lignes d'une entree en attente (modification).
create policy "suppression lignes receptions en attente" on receptions_lignes
  for delete using (
    reception_id in (
      select id from receptions
      where statut = 'en_attente'
        and entrepot_id in (select entrepots_visibles())
        and (cree_par = auth.uid() or role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot'))
    )
  );

alter table bons_sortie enable row level security;
create policy "lecture bons sortie visibles" on bons_sortie
  for select using (entrepot_id in (select entrepots_visibles()));

-- Sortie : tous les roles operationnels (y compris Magasinier), meme regle que la saisie d'une reception.
create policy "creation bons sortie" on bons_sortie
  for insert with check (entrepot_id in (select entrepots_visibles()));

alter table bons_sortie_lignes enable row level security;
create policy "lecture bons sortie lignes visibles" on bons_sortie_lignes
  for select using (bon_sortie_id in (select id from bons_sortie where entrepot_id in (select entrepots_visibles())));

create policy "creation bons sortie lignes" on bons_sortie_lignes
  for insert with check (
    bon_sortie_id in (select id from bons_sortie where entrepot_id in (select entrepots_visibles()))
  );

-- Necessaire pour que "for update" fonctionne dans creer_reintegration (Postgres
-- exige une policy UPDATE, pas seulement SELECT, pour autoriser le verrou d'une
-- ligne). Aucune mise a jour reelle n'est faite sur cette table par ailleurs.
create policy "verrou bons sortie lignes pour reintegration" on bons_sortie_lignes
  for update using (
    bon_sortie_id in (select id from bons_sortie where entrepot_id in (select entrepots_visibles()))
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  );

-- Reintegration : reservee a Administrateur/Superviseur/Gestionnaire, pas le Magasinier (meme regle que la validation d'une reception).
alter table reintegrations enable row level security;
create policy "lecture reintegrations visibles" on reintegrations
  for select using (entrepot_id in (select entrepots_visibles()));

create policy "creation reintegrations" on reintegrations
  for insert with check (
    entrepot_id in (select entrepots_visibles())
    and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
  );

alter table reintegrations_lignes enable row level security;
create policy "lecture reintegrations lignes visibles" on reintegrations_lignes
  for select using (reintegration_id in (select id from reintegrations where entrepot_id in (select entrepots_visibles())));

create policy "creation reintegrations lignes" on reintegrations_lignes
  for insert with check (
    reintegration_id in (
      select id from reintegrations
      where entrepot_id in (select entrepots_visibles())
        and role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot')
    )
  );

alter table transferts enable row level security;
create policy "lecture transferts visibles" on transferts
  for select using (
    entrepot_source_id in (select entrepots_visibles())
    or entrepot_destination_id in (select entrepots_visibles())
  );

-- Demande : Administrateur ou Superviseur Entrepot (cahier des charges).
create policy "creation transferts" on transferts
  for insert with check (
    role_courant() in ('administrateur', 'superviseur_entrepot')
    and entrepot_source_id in (select entrepots_visibles())
    and entrepot_destination_id in (select entrepots_visibles())
  );

-- Validation (demande -> valide) : Administrateur ou Superviseur Entrepot.
-- Expedition (valide -> en_transit) : + Gestionnaire/Magasinier de la source.
-- Reception (en_transit -> recu) : + Gestionnaire/Magasinier de la destination.
-- Une seule policy UPDATE couvrant les trois transitions ; le detail de qui
-- peut faire quoi est verifie dans les fonctions RPC elles-memes.
create policy "maj transferts" on transferts
  for update using (
    role_courant() in ('administrateur', 'superviseur_entrepot')
    or entrepot_source_id in (select entrepots_visibles())
    or entrepot_destination_id in (select entrepots_visibles())
  );

alter table transferts_lignes enable row level security;
create policy "lecture transferts lignes visibles" on transferts_lignes
  for select using (
    transfert_id in (
      select id from transferts
      where entrepot_source_id in (select entrepots_visibles())
         or entrepot_destination_id in (select entrepots_visibles())
    )
  );

create policy "creation transferts lignes" on transferts_lignes
  for insert with check (
    transfert_id in (
      select id from transferts
      where role_courant() in ('administrateur', 'superviseur_entrepot')
        and entrepot_source_id in (select entrepots_visibles())
        and entrepot_destination_id in (select entrepots_visibles())
    )
  );

-- Necessaire pour que "for update" fonctionne dans les fonctions RPC de
-- transfert (meme piege que sur bons_sortie_lignes : Postgres exige une
-- policy UPDATE, pas seulement SELECT, pour autoriser le verrou d'une ligne).
create policy "maj transferts lignes" on transferts_lignes
  for update using (
    transfert_id in (
      select id from transferts
      where entrepot_source_id in (select entrepots_visibles())
         or entrepot_destination_id in (select entrepots_visibles())
    )
  );

alter table inventaires enable row level security;
create policy "lecture inventaires visibles" on inventaires
  for select using (entrepot_id in (select entrepots_visibles()));

alter table inventaires_lignes enable row level security;
create policy "lecture inventaires lignes visibles" on inventaires_lignes
  for select using (inventaire_id in (select id from inventaires where entrepot_id in (select entrepots_visibles())));

alter table affectations_outillage enable row level security;
create policy "lecture affectations visibles" on affectations_outillage
  for select using (entrepot_id in (select entrepots_visibles()));

-- Commandes fournisseurs : quiconque voit le depot de livraison (une policy "for all").
alter table commandes_fournisseurs enable row level security;
create policy "acces commandes fournisseurs visibles" on commandes_fournisseurs
  for all
  using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

alter table commandes_fournisseurs_lignes enable row level security;
create policy "acces lignes commandes fournisseurs visibles" on commandes_fournisseurs_lignes
  for all
  using (commande_id in (select id from commandes_fournisseurs where entrepot_id in (select entrepots_visibles())))
  with check (commande_id in (select id from commandes_fournisseurs where entrepot_id in (select entrepots_visibles())));

-- ============================================================
-- 3.5 FONCTIONS D'ECRITURE DU STOCK (RPC)
-- ============================================================
-- "security invoker" : la fonction s'execute avec les privileges de
-- l'appelant, donc les policies RLS ci-dessus continuent de s'appliquer.
-- Executees comme une transaction unique (garantie native de PL/pgSQL),
-- avec verrou sur la ligne source pour deplacer_stock, pour rester
-- coherent en cas d'acces concurrents (cahier des charges, section 19).

-- Ajoute une quantite a un lot (le cree s'il n'existe pas encore a cet
-- emplacement avec exactement les memes caracteristiques).
create function ajouter_lot(
  p_produit_id uuid,
  p_entrepot_id uuid,
  p_emplacement_id uuid,
  p_lot text,
  p_numero_serie text,
  p_date_expiration date,
  p_date_entree timestamptz,
  p_prix_unitaire numeric,
  p_quantite integer
)
returns void
language plpgsql
security invoker
as $$
declare
  v_id uuid;
  v_date_entree timestamptz := coalesce(p_date_entree, now());
begin
  if p_quantite is null or p_quantite <= 0 then
    return;
  end if;

  select id into v_id from stock_lots
    where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_id
      and lot is not distinct from nullif(p_lot, '')
      and numero_serie is not distinct from nullif(p_numero_serie, '')
      and date_expiration is not distinct from p_date_expiration
      and date_entree = v_date_entree
    limit 1
    for update;

  if v_id is not null then
    update stock_lots set quantite = quantite + p_quantite where id = v_id;
  else
    insert into stock_lots (
      produit_id, entrepot_id, emplacement_id, lot, numero_serie, date_expiration, date_entree, prix_unitaire, quantite
    )
    values (
      p_produit_id, p_entrepot_id, p_emplacement_id, nullif(p_lot, ''), nullif(p_numero_serie, ''),
      p_date_expiration, v_date_entree, p_prix_unitaire, p_quantite
    );
  end if;
end;
$$;

-- Garde stock_lots egal a stock_produits apres chaque ecriture du stock.
-- Les fonctions qui connaissent le lot (reception, sortie, reintegration)
-- mettent stock_lots a jour AVANT stock_produits : l'ecart est alors nul et
-- ce trigger ne fait rien. Pour toutes les autres operations :
--   - stock en baisse : les lots sont consommes dans l'ordre FEFO puis FIFO
--     (expiration la plus proche d'abord, lots sans date ensuite, puis
--     entree la plus ancienne) ;
--   - stock en hausse : on repose les lots retires plus tot dans la meme
--     transaction (deplacement interne), sinon un lot "sans lot" est cree.
create function synchroniser_lots()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_produit_id uuid;
  v_entrepot_id uuid;
  v_emplacement_id uuid;
  v_cible integer;
  v_total integer;
  v_ecart integer;
  v_prise integer;
  v_lot record;
begin
  if tg_op = 'DELETE' then
    v_produit_id := old.produit_id;
    v_entrepot_id := old.entrepot_id;
    v_emplacement_id := old.emplacement_id;
    v_cible := 0;
  else
    v_produit_id := new.produit_id;
    v_entrepot_id := new.entrepot_id;
    v_emplacement_id := new.emplacement_id;
    v_cible := new.quantite;
  end if;

  select coalesce(sum(quantite), 0) into v_total from stock_lots
    where produit_id = v_produit_id and entrepot_id = v_entrepot_id and emplacement_id = v_emplacement_id;

  v_ecart := v_cible - v_total;
  if v_ecart = 0 then
    return null;
  end if;

  -- Menage : restes de transactions precedentes.
  delete from lots_en_mouvement where transaction_id <> txid_current();

  if v_ecart > 0 then
    for v_lot in
      select * from lots_en_mouvement
        where transaction_id = txid_current() and produit_id = v_produit_id and entrepot_id = v_entrepot_id
        order by date_expiration asc nulls last, date_entree asc, id
    loop
      exit when v_ecart <= 0;
      v_prise := least(v_lot.quantite, v_ecart);
      perform ajouter_lot(
        v_produit_id, v_entrepot_id, v_emplacement_id, v_lot.lot, v_lot.numero_serie,
        v_lot.date_expiration, v_lot.date_entree, v_lot.prix_unitaire, v_prise
      );
      if v_prise = v_lot.quantite then
        delete from lots_en_mouvement where id = v_lot.id;
      else
        update lots_en_mouvement set quantite = quantite - v_prise where id = v_lot.id;
      end if;
      v_ecart := v_ecart - v_prise;
    end loop;

    if v_ecart > 0 then
      perform ajouter_lot(v_produit_id, v_entrepot_id, v_emplacement_id, null, null, null, now(), null, v_ecart);
    end if;
  else
    v_ecart := -v_ecart;
    for v_lot in
      select * from stock_lots
        where produit_id = v_produit_id and entrepot_id = v_entrepot_id and emplacement_id = v_emplacement_id
        order by date_expiration asc nulls last, date_entree asc, id
        for update
    loop
      exit when v_ecart <= 0;
      v_prise := least(v_lot.quantite, v_ecart);
      if v_prise = v_lot.quantite then
        delete from stock_lots where id = v_lot.id;
      else
        update stock_lots set quantite = quantite - v_prise where id = v_lot.id;
      end if;
      insert into lots_en_mouvement (
        produit_id, entrepot_id, lot, numero_serie, date_expiration, date_entree, prix_unitaire, quantite
      )
      values (
        v_produit_id, v_entrepot_id, v_lot.lot, v_lot.numero_serie, v_lot.date_expiration,
        v_lot.date_entree, v_lot.prix_unitaire, v_prise
      );
      v_ecart := v_ecart - v_prise;
    end loop;
  end if;

  return null;
end;
$$;

create trigger stock_produits_synchroniser_lots
  after insert or update of quantite or delete on stock_produits
  for each row execute function synchroniser_lots();

-- Ajoute (ou retire, delta negatif) une quantite a un emplacement et
-- renvoie le stock avant / apres. Refuse un stock negatif.
create function ajuster_stock_emplacement(
  p_produit_id uuid,
  p_entrepot_id uuid,
  p_emplacement_id uuid,
  p_delta integer,
  out o_avant integer,
  out o_apres integer
)
language plpgsql
security invoker
as $$
begin
  select quantite into o_avant from stock_produits
    where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_id
    for update;
  o_avant := coalesce(o_avant, 0);
  o_apres := o_avant + p_delta;
  if o_apres < 0 then
    raise exception 'Stock insuffisant a cet emplacement.';
  end if;
  if o_apres = 0 then
    delete from stock_produits
      where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_id;
  else
    insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
    values (p_produit_id, p_entrepot_id, p_emplacement_id, o_apres)
    on conflict (produit_id, entrepot_id, emplacement_id)
    do update set quantite = excluded.quantite;
  end if;
end;
$$;

-- Retire une quantite d'un lot precis a un emplacement (les plus anciennes
-- entrees d'abord) et renvoie la quantite effectivement retiree. Si le lot
-- n'y suffit pas, synchroniser_lots complete selon l'ordre FEFO / FIFO.
create function retirer_lot(
  p_produit_id uuid,
  p_entrepot_id uuid,
  p_emplacement_id uuid,
  p_lot text,
  p_numero_serie text,
  p_date_expiration date,
  p_quantite integer
)
returns integer
language plpgsql
security invoker
as $$
declare
  v_lot record;
  v_reste integer := p_quantite;
  v_prise integer;
begin
  for v_lot in
    select * from stock_lots
      where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_id
        and lot is not distinct from p_lot
        and numero_serie is not distinct from p_numero_serie
        and date_expiration is not distinct from p_date_expiration
      order by date_entree asc, id
      for update
  loop
    exit when v_reste <= 0;
    v_prise := least(v_lot.quantite, v_reste);
    if v_prise = v_lot.quantite then
      delete from stock_lots where id = v_lot.id;
    else
      update stock_lots set quantite = quantite - v_prise where id = v_lot.id;
    end if;
    v_reste := v_reste - v_prise;
  end loop;
  return p_quantite - v_reste;
end;
$$;

-- Declaration manuelle d'une non-conformite depuis le stock, puis traitement
-- d'un dossier (liberation, retour fournisseur, rebut, reparation).
create function declarer_non_conformite(
  p_entrepot_id uuid,
  p_produit_id uuid,
  p_emplacement_id uuid,
  p_quantite integer,
  p_motif text,
  p_constat text,
  p_stock_lot_id uuid default null,
  p_fournisseur_id uuid default null,
  p_numero_po text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_quarantaine_id uuid;
  v_lot stock_lots%rowtype;
  v_numero_nc text;
  v_nc_id uuid;
  v_prix numeric;
  v_source record;
  v_dest record;
begin
  select entreprise_id into v_entreprise_id from entrepots where id = p_entrepot_id;
  if v_entreprise_id is null then
    raise exception 'Entrepot introuvable.';
  end if;
  if p_quantite is null or p_quantite <= 0 then
    raise exception 'La quantite doit etre positive.';
  end if;
  if p_motif not in ('endommage', 'avarie_transport', 'non_conforme_commande', 'surplus',
                     'perime', 'documents_manquants', 'defaut_qualite', 'autre') then
    raise exception 'Motif de non-conformite inconnu.';
  end if;
  if nullif(btrim(coalesce(p_constat, '')), '') is null then
    raise exception 'Le constat est obligatoire.';
  end if;

  select id into v_quarantaine_id from emplacements where entrepot_id = p_entrepot_id and est_quarantaine;
  if v_quarantaine_id is null then
    raise exception 'Cet entrepot n''a pas d''emplacement Quarantaine.';
  end if;
  if p_emplacement_id = v_quarantaine_id then
    raise exception 'Ce produit est deja en quarantaine.';
  end if;

  v_lot := null;
  -- Le lot d'abord, le stock ensuite (voir synchroniser_lots).
  if p_stock_lot_id is not null then
    select * into v_lot from stock_lots
      where id = p_stock_lot_id and produit_id = p_produit_id and entrepot_id = p_entrepot_id
        and emplacement_id = p_emplacement_id
      for update;
    if not found or v_lot.quantite < p_quantite then
      raise exception 'Quantite insuffisante dans le lot choisi.';
    end if;
    if v_lot.quantite = p_quantite then
      delete from stock_lots where id = v_lot.id;
    else
      update stock_lots set quantite = quantite - p_quantite where id = v_lot.id;
    end if;
    perform ajouter_lot(
      p_produit_id, p_entrepot_id, v_quarantaine_id, v_lot.lot, v_lot.numero_serie,
      v_lot.date_expiration, v_lot.date_entree, v_lot.prix_unitaire, p_quantite
    );
  end if;

  select * into v_source from ajuster_stock_emplacement(p_produit_id, p_entrepot_id, p_emplacement_id, -p_quantite);
  select * into v_dest from ajuster_stock_emplacement(p_produit_id, p_entrepot_id, v_quarantaine_id, p_quantite);

  v_numero_nc := 'NC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('non_conformites_numero_seq')::text, 5, '0');
  select prix_moyen_pondere into v_prix from produits where id = p_produit_id;

  insert into mouvements_stock (
    entreprise_id, produit_id, entrepot_id, emplacement_id, emplacement_origine_id, type, quantite,
    stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie
  )
  values (
    v_entreprise_id, p_produit_id, p_entrepot_id, v_quarantaine_id, p_emplacement_id, 'deplacement', p_quantite,
    v_dest.o_avant, v_dest.o_apres, auth.uid(), v_numero_nc, 'Mise en quarantaine', v_lot.lot, v_lot.numero_serie
  );

  insert into non_conformites (
    entreprise_id, numero, entrepot_id, emplacement_id, produit_id, lot, numero_serie, date_expiration,
    date_entree_lot, prix_unitaire, origine, fournisseur_id, numero_po, motif, constat,
    quantite_initiale, quantite_restante, declare_par
  )
  values (
    v_entreprise_id, v_numero_nc, p_entrepot_id, v_quarantaine_id, p_produit_id, v_lot.lot, v_lot.numero_serie,
    v_lot.date_expiration, v_lot.date_entree, coalesce(v_lot.prix_unitaire, v_prix), 'stock', p_fournisseur_id,
    nullif(btrim(coalesce(p_numero_po, '')), ''), p_motif, btrim(p_constat), p_quantite, p_quantite, auth.uid()
  )
  returning id into v_nc_id;

  return v_nc_id;
end;
$$;

grant execute on function declarer_non_conformite to authenticated;

-- p_decisions : tableau JSON, un objet par decision :
--   decision ('liberation' | 'retour_fournisseur' | 'rebut' | 'reparation'),
--   quantite, source ('a_traiter' par defaut | 'reparation'),
--   emplacement_destination_id (liberation), reference_document.
create function traiter_non_conformite(
  p_non_conformite_id uuid,
  p_decisions jsonb,
  p_commentaire text,
  p_date_mouvement timestamptz default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_nc non_conformites%rowtype;
  v_date timestamptz := coalesce(p_date_mouvement, now());
  v_d jsonb;
  v_decision text;
  v_quantite integer;
  v_source text;
  v_destination uuid;
  v_reference text;
  v_a_traiter integer;
  v_en_reparation integer;
  v_restante integer;
  v_dest_est_quarantaine boolean;
  v_dest_entrepot uuid;
  v_q record;
  v_dest record;
  v_motif text;
begin
  select * into v_nc from non_conformites where id = p_non_conformite_id for update;
  if not found then
    raise exception 'Dossier de non-conformite introuvable.';
  end if;
  if v_nc.statut = 'cloturee' then
    raise exception 'Ce dossier est deja cloture.';
  end if;
  if nullif(btrim(coalesce(p_commentaire, '')), '') is null then
    raise exception 'Le commentaire de traitement est obligatoire.';
  end if;
  if p_decisions is null or jsonb_array_length(p_decisions) = 0 then
    raise exception 'Indique au moins une decision.';
  end if;

  -- Controle des quantites, avant toute ecriture.
  v_a_traiter := v_nc.quantite_restante - v_nc.quantite_en_reparation;
  v_en_reparation := v_nc.quantite_en_reparation;
  for v_d in select * from jsonb_array_elements(p_decisions)
  loop
    v_decision := v_d->>'decision';
    v_quantite := (v_d->>'quantite')::integer;
    v_source := coalesce(nullif(v_d->>'source', ''), 'a_traiter');
    if v_decision not in ('liberation', 'retour_fournisseur', 'rebut', 'reparation') then
      raise exception 'Decision inconnue.';
    end if;
    if v_quantite is null or v_quantite <= 0 then
      raise exception 'Chaque decision doit porter sur une quantite positive.';
    end if;
    if v_source not in ('a_traiter', 'reparation') then
      raise exception 'Origine de quantite inconnue.';
    end if;
    if v_decision = 'reparation' and v_source <> 'a_traiter' then
      raise exception 'Une quantite deja en reparation ne peut pas etre renvoyee en reparation.';
    end if;
    if v_decision = 'liberation' then
      v_destination := nullif(v_d->>'emplacement_destination_id', '')::uuid;
      select est_quarantaine, entrepot_id into v_dest_est_quarantaine, v_dest_entrepot
        from emplacements where id = v_destination;
      if v_destination is null or v_dest_entrepot is distinct from v_nc.entrepot_id or v_dest_est_quarantaine then
        raise exception 'Choisis un emplacement de destination de cet entrepot (hors Quarantaine).';
      end if;
    end if;
    if v_source = 'a_traiter' then
      v_a_traiter := v_a_traiter - v_quantite;
    else
      v_en_reparation := v_en_reparation - v_quantite;
    end if;
    if v_a_traiter < 0 or v_en_reparation < 0 then
      raise exception 'Quantite superieure a la quantite a traiter.';
    end if;
  end loop;

  -- Application des decisions.
  v_restante := v_nc.quantite_restante;
  v_en_reparation := v_nc.quantite_en_reparation;
  for v_d in select * from jsonb_array_elements(p_decisions)
  loop
    v_decision := v_d->>'decision';
    v_quantite := (v_d->>'quantite')::integer;
    v_source := coalesce(nullif(v_d->>'source', ''), 'a_traiter');
    v_destination := nullif(v_d->>'emplacement_destination_id', '')::uuid;
    v_reference := nullif(btrim(coalesce(v_d->>'reference_document', '')), '');

    insert into non_conformites_traitements (
      non_conformite_id, decision, source, quantite, emplacement_destination_id, reference_document, commentaire, traite_par, cree_le
    )
    values (
      v_nc.id, v_decision, v_source, v_quantite,
      case when v_decision = 'liberation' then v_destination end,
      v_reference, btrim(p_commentaire), auth.uid(), v_date
    );

    if v_decision = 'reparation' then
      -- Le produit reste en quarantaine, en attente de reparation.
      v_en_reparation := v_en_reparation + v_quantite;
      continue;
    end if;

    -- Le lot d'abord, le stock ensuite (voir synchroniser_lots).
    perform retirer_lot(v_nc.produit_id, v_nc.entrepot_id, v_nc.emplacement_id, v_nc.lot, v_nc.numero_serie,
                        v_nc.date_expiration, v_quantite);
    if v_decision = 'liberation' then
      perform ajouter_lot(v_nc.produit_id, v_nc.entrepot_id, v_destination, v_nc.lot, v_nc.numero_serie,
                          v_nc.date_expiration, coalesce(v_nc.date_entree_lot, v_date), v_nc.prix_unitaire, v_quantite);
    end if;

    select * into v_q from ajuster_stock_emplacement(v_nc.produit_id, v_nc.entrepot_id, v_nc.emplacement_id, -v_quantite);

    if v_decision = 'liberation' then
      select * into v_dest from ajuster_stock_emplacement(v_nc.produit_id, v_nc.entrepot_id, v_destination, v_quantite);
      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id, emplacement_origine_id, type, quantite,
        stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, cree_le
      )
      values (
        v_nc.entreprise_id, v_nc.produit_id, v_nc.entrepot_id, v_destination, v_nc.emplacement_id, 'deplacement', v_quantite,
        v_dest.o_avant, v_dest.o_apres, auth.uid(), v_nc.numero, 'Libération de quarantaine', v_nc.lot, v_nc.numero_serie, v_date
      );
    else
      v_motif := case v_decision when 'retour_fournisseur' then 'Retour fournisseur' else 'Mise au rebut' end
                 || coalesce(' (' || v_reference || ')', '');
      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite,
        stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, cree_le
      )
      values (
        v_nc.entreprise_id, v_nc.produit_id, v_nc.entrepot_id, v_nc.emplacement_id, 'sortie', v_quantite,
        v_q.o_avant, v_q.o_apres, auth.uid(), v_nc.numero, v_motif, v_nc.lot, v_nc.numero_serie, v_date
      );
    end if;

    v_restante := v_restante - v_quantite;
    if v_source = 'reparation' then
      v_en_reparation := v_en_reparation - v_quantite;
    end if;
  end loop;

  update non_conformites
    set quantite_restante = v_restante,
        quantite_en_reparation = v_en_reparation,
        statut = case
          when v_restante = 0 then 'cloturee'
          when v_en_reparation = v_restante then 'en_reparation'
          else 'en_cours'
        end,
        cloture_le = case when v_restante = 0 then v_date end
    where id = v_nc.id;
end;
$$;

grant execute on function traiter_non_conformite to authenticated;

create function affecter_localisation(
  p_produit_id uuid,
  p_entrepot_id uuid,
  p_emplacement_id uuid,
  p_quantite integer,
  p_reference text,
  p_motif text default 'Affectation manuelle de localisation'
)
returns void
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_stock_avant integer;
  v_stock_apres integer;
begin
  if p_quantite <= 0 then
    raise exception 'La quantite doit etre positive.';
  end if;

  select entreprise_id into v_entreprise_id from produits where id = p_produit_id;

  select quantite into v_stock_avant from stock_produits
    where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_id;
  v_stock_avant := coalesce(v_stock_avant, 0);
  v_stock_apres := v_stock_avant + p_quantite;

  insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
  values (p_produit_id, p_entrepot_id, p_emplacement_id, p_quantite)
  on conflict (produit_id, entrepot_id, emplacement_id)
  do update set quantite = stock_produits.quantite + excluded.quantite;

  insert into mouvements_stock (
    entreprise_id, produit_id, entrepot_id, emplacement_id,
    type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif
  )
  values (
    v_entreprise_id, p_produit_id, p_entrepot_id, p_emplacement_id,
    'entree', p_quantite, v_stock_avant, v_stock_apres, auth.uid(), p_reference, p_motif
  );
end;
$$;

grant execute on function affecter_localisation to authenticated;

create function deplacer_stock(
  p_produit_id uuid,
  p_entrepot_id uuid,
  p_emplacement_source_id uuid,
  p_emplacement_destination_id uuid,
  p_quantite integer,
  p_reference text,
  p_motif text default 'Deplacement interne'
)
returns void
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_stock_source integer;
  v_stock_avant_dest integer;
  v_stock_apres_dest integer;
begin
  if p_quantite <= 0 then
    raise exception 'La quantite doit etre positive.';
  end if;
  if p_emplacement_source_id = p_emplacement_destination_id then
    raise exception 'L''emplacement de destination doit etre different de l''origine.';
  end if;

  select entreprise_id into v_entreprise_id from produits where id = p_produit_id;

  select quantite into v_stock_source from stock_produits
    where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_source_id
    for update;

  if v_stock_source is null or v_stock_source < p_quantite then
    raise exception 'Quantite insuffisante a l''emplacement source.';
  end if;

  if v_stock_source = p_quantite then
    delete from stock_produits
      where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_source_id;
  else
    update stock_produits set quantite = quantite - p_quantite
      where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_source_id;
  end if;

  select quantite into v_stock_avant_dest from stock_produits
    where produit_id = p_produit_id and entrepot_id = p_entrepot_id and emplacement_id = p_emplacement_destination_id;
  v_stock_avant_dest := coalesce(v_stock_avant_dest, 0);
  v_stock_apres_dest := v_stock_avant_dest + p_quantite;

  insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
  values (p_produit_id, p_entrepot_id, p_emplacement_destination_id, p_quantite)
  on conflict (produit_id, entrepot_id, emplacement_id)
  do update set quantite = stock_produits.quantite + excluded.quantite;

  insert into mouvements_stock (
    entreprise_id, produit_id, entrepot_id, emplacement_id, emplacement_origine_id,
    type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif
  )
  values (
    v_entreprise_id, p_produit_id, p_entrepot_id, p_emplacement_destination_id, p_emplacement_source_id,
    'deplacement', p_quantite, v_stock_avant_dest, v_stock_apres_dest, auth.uid(), p_reference, p_motif
  );
end;
$$;

grant execute on function deplacer_stock to authenticated;

-- Cree une reception (en-tete + lignes) en une seule transaction, statut
-- 'en_attente'. p_lignes : tableau JSON, un objet par ligne avec les cles
-- produit_id, emplacement_id, quantite_attendue, quantite_recue, lot,
-- numero_serie, date_expiration, prix_unitaire, anomalie.
-- p_date_mouvement (optionnel) fixe la date de la reception et l'annee de
-- son numero, comme pour les reintegrations.
-- Ajoute les lignes d'une entree (creation ou modification), avec les memes
-- controles : localisation existante dans un depot visible de l'entreprise,
-- date d'expiration et lot, non-conformite. Le depot de chaque ligne est
-- celui de sa localisation.
create function ajouter_lignes_reception(p_reception_id uuid, p_entreprise_id uuid, p_lignes jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  v_ligne jsonb;
  v_gere_expiration boolean;
  v_reference text;
  v_quantite_recue integer;
  v_quantite_nc integer;
  v_motif_nc text;
  v_entrepot_ligne uuid;
begin
  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    select gere_expiration, reference into v_gere_expiration, v_reference
      from produits where id = (v_ligne->>'produit_id')::uuid;

    select e.entrepot_id into v_entrepot_ligne
      from emplacements e where e.id = nullif(v_ligne->>'emplacement_id', '')::uuid;
    -- Une localisation d'un depot non attribue est invisible (securite) : meme message.
    if v_entrepot_ligne is null then
      raise exception 'Produit % : localisation introuvable ou depot non autorise.', v_reference;
    end if;
    if v_entrepot_ligne not in (select entrepots_visibles()) then
      raise exception 'Produit % : vous n''avez pas acces au depot de cette localisation.', v_reference;
    end if;
    if not exists (select 1 from entrepots where id = v_entrepot_ligne and entreprise_id = p_entreprise_id) then
      raise exception 'Produit % : le depot n''appartient pas a votre entreprise.', v_reference;
    end if;

    if coalesce(v_gere_expiration, false) and nullif(v_ligne->>'date_expiration', '') is null then
      raise exception 'Produit % : la date d''expiration est obligatoire.', v_reference;
    end if;
    if nullif(v_ligne->>'date_expiration', '') is not null
       and nullif(v_ligne->>'lot', '') is null and nullif(v_ligne->>'numero_serie', '') is null then
      raise exception 'Produit % : le numero de lot (ou de serie) est obligatoire avec une date d''expiration.', v_reference;
    end if;

    v_quantite_recue := coalesce((v_ligne->>'quantite_recue')::integer, 0);
    v_quantite_nc := coalesce((v_ligne->>'quantite_non_conforme')::integer, 0);
    v_motif_nc := nullif(v_ligne->>'motif_non_conformite', '');
    -- Ancienne application : case "anomalie" cochee = toute la ligne non conforme.
    if v_quantite_nc = 0 and coalesce((v_ligne->>'anomalie')::boolean, false) then
      v_quantite_nc := v_quantite_recue;
    end if;
    if v_quantite_nc < 0 or v_quantite_nc > v_quantite_recue then
      raise exception 'Produit % : la quantite non conforme doit etre comprise entre 0 et la quantite recue.', v_reference;
    end if;
    if v_quantite_nc > 0 then
      v_motif_nc := coalesce(v_motif_nc, 'autre');
      if v_motif_nc not in ('endommage', 'avarie_transport', 'non_conforme_commande', 'surplus',
                            'perime', 'documents_manquants', 'defaut_qualite', 'autre') then
        raise exception 'Produit % : motif de non-conformite inconnu.', v_reference;
      end if;
    else
      v_motif_nc := null;
    end if;

    insert into receptions_lignes (
      reception_id, produit_id, emplacement_id, quantite_attendue, quantite_recue,
      lot, numero_serie, date_expiration, prix_unitaire, anomalie,
      quantite_non_conforme, motif_non_conformite, constat_non_conformite
    )
    values (
      p_reception_id,
      (v_ligne->>'produit_id')::uuid,
      (v_ligne->>'emplacement_id')::uuid,
      coalesce((v_ligne->>'quantite_attendue')::integer, 0),
      v_quantite_recue,
      nullif(v_ligne->>'lot', ''),
      nullif(v_ligne->>'numero_serie', ''),
      nullif(v_ligne->>'date_expiration', '')::date,
      coalesce((v_ligne->>'prix_unitaire')::numeric, 0),
      v_quantite_nc > 0,
      v_quantite_nc,
      v_motif_nc,
      case when v_quantite_nc > 0 then nullif(btrim(v_ligne->>'constat_non_conformite'), '') end
    );
  end loop;
end;
$$;

grant execute on function ajouter_lignes_reception to authenticated;

create function creer_reception(
  p_entrepot_id uuid,
  p_fournisseur_id uuid,
  p_numero_po text,
  p_lignes jsonb,
  p_notes text default null,
  p_date_mouvement timestamptz default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_reception_id uuid;
  v_numero text;
  v_date timestamptz;
  v_entrepot_principal uuid;
begin
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une reception doit contenir au moins une ligne.';
  end if;

  -- Une entree peut couvrir plusieurs depots : le depot de chaque ligne est
  -- celui de sa localisation. L'en-tete garde un depot "principal" (celui
  -- passe en parametre, sinon celui de la premiere ligne).
  v_entrepot_principal := coalesce(
    p_entrepot_id,
    (select e.entrepot_id from emplacements e where e.id = (p_lignes->0->>'emplacement_id')::uuid)
  );
  if v_entrepot_principal is null then
    raise exception 'Ligne 1 : localisation introuvable ou depot non autorise.';
  end if;
  select entreprise_id into v_entreprise_id from entrepots where id = v_entrepot_principal;
  if v_entreprise_id is null then
    raise exception 'Entrepot introuvable.';
  end if;

  v_date := coalesce(p_date_mouvement, now());
  v_numero := 'REC-' || to_char(v_date, 'YYYY') || '-' || lpad(nextval('receptions_numero_seq')::text, 5, '0');

  insert into receptions (entreprise_id, numero, entrepot_id, fournisseur_id, numero_po, statut, cree_par, notes, cree_le)
  values (
    v_entreprise_id, v_numero, v_entrepot_principal, p_fournisseur_id, nullif(p_numero_po, ''), 'en_attente', auth.uid(),
    nullif(p_notes, ''), v_date
  )
  returning id into v_reception_id;

  perform ajouter_lignes_reception(v_reception_id, v_entreprise_id, p_lignes);

  return v_reception_id;
end;
$$;

grant execute on function creer_reception to authenticated;

-- Valide une reception : ventile chaque ligne entre emplacement normal et
-- Quarantaine (anomalie -> tout en Quarantaine ; surplus recu > attendu ->
-- la part en trop en Quarantaine), met a jour le stock et l'historique,
-- recalcule le Prix Moyen Pondere du produit (sur son stock total, tous
-- entrepots confondus), et fixe le statut final de la reception.
create function valider_reception(p_reception_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_entrepot_id uuid;
  v_numero text;
  v_date_entree timestamptz;
  v_fournisseur_id uuid;
  v_numero_po text;
  v_ligne record;
  v_quarantaine_id uuid;
  v_qte_normale integer;
  v_qte_quarantaine integer;
  v_stock_avant integer;
  v_stock_apres integer;
  v_stock_total_avant integer;
  v_pmp_avant numeric;
  v_pmp_apres numeric;
  v_une_ligne_incomplete boolean := false;
  v_une_ligne_anomalie boolean := false;
  v_statut text;
  v_numero_nc text;
  v_entrepot_ligne uuid;
  v_statut_actuel text;
begin
  -- Verrou : deux validations simultanees ne peuvent pas ajouter deux fois le stock.
  select statut into v_statut_actuel from receptions where id = p_reception_id for update;
  if v_statut_actuel is not null and v_statut_actuel <> 'en_attente' then
    raise exception 'Cette entree n''est plus en attente (deja validee ou annulee).';
  end if;

  select entreprise_id, entrepot_id, numero, cree_le, fournisseur_id, numero_po
    into v_entreprise_id, v_entrepot_id, v_numero, v_date_entree, v_fournisseur_id, v_numero_po
    from receptions where id = p_reception_id;

  if v_entrepot_id is null then
    raise exception 'Reception introuvable.';
  end if;

  for v_ligne in select * from receptions_lignes where reception_id = p_reception_id
  loop
    -- Depot de la ligne = depot de sa localisation (une entree peut couvrir
    -- plusieurs depots) ; a defaut, le depot de l'en-tete.
    v_entrepot_ligne := coalesce(
      (select e.entrepot_id from emplacements e where e.id = v_ligne.emplacement_id),
      v_entrepot_id
    );
    select id into v_quarantaine_id from emplacements where entrepot_id = v_entrepot_ligne and est_quarantaine;
    if v_ligne.quantite_recue < v_ligne.quantite_attendue then
      v_une_ligne_incomplete := true;
    end if;

    -- Seule la quantite declaree non conforme par l'operateur part en
    -- quarantaine (lignes anterieures : case "anomalie" = toute la ligne).
    v_qte_quarantaine := least(greatest(coalesce(v_ligne.quantite_non_conforme, 0), 0), v_ligne.quantite_recue);
    if v_qte_quarantaine = 0 and v_ligne.anomalie then
      v_qte_quarantaine := v_ligne.quantite_recue;
    end if;
    v_qte_normale := v_ligne.quantite_recue - v_qte_quarantaine;
    if v_qte_quarantaine > 0 then
      v_une_ligne_anomalie := true;
    end if;

    -- PMP : capturer le stock total du produit (tous entrepots) et le PMP
    -- courant AVANT d'ajouter quoi que ce soit pour cette ligne.
    select coalesce(sum(sp.quantite), 0) into v_stock_total_avant
      from stock_produits sp where sp.produit_id = v_ligne.produit_id;
    select prix_moyen_pondere into v_pmp_avant from produits where id = v_ligne.produit_id;

    if v_qte_normale > 0 then
      select quantite into v_stock_avant from stock_produits
        where produit_id = v_ligne.produit_id and entrepot_id = v_entrepot_ligne and emplacement_id = v_ligne.emplacement_id;
      v_stock_avant := coalesce(v_stock_avant, 0);
      v_stock_apres := v_stock_avant + v_qte_normale;

      -- Le lot d'abord, le stock ensuite (voir synchroniser_lots).
      perform ajouter_lot(
        v_ligne.produit_id, v_entrepot_ligne, v_ligne.emplacement_id, v_ligne.lot, v_ligne.numero_serie,
        v_ligne.date_expiration, v_date_entree, v_ligne.prix_unitaire, v_qte_normale
      );

      insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
      values (v_ligne.produit_id, v_entrepot_ligne, v_ligne.emplacement_id, v_qte_normale)
      on conflict (produit_id, entrepot_id, emplacement_id)
      do update set quantite = stock_produits.quantite + excluded.quantite;

      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite,
        stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, prix_unitaire
      )
      values (
        v_entreprise_id, v_ligne.produit_id, v_entrepot_ligne, v_ligne.emplacement_id, 'entree', v_qte_normale,
        v_stock_avant, v_stock_apres, auth.uid(), v_numero, 'Réception validée',
        v_ligne.lot, v_ligne.numero_serie, v_ligne.prix_unitaire
      );
    end if;

    if v_qte_quarantaine > 0 then
      v_numero_nc := 'NC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('non_conformites_numero_seq')::text, 5, '0');

      select quantite into v_stock_avant from stock_produits
        where produit_id = v_ligne.produit_id and entrepot_id = v_entrepot_ligne and emplacement_id = v_quarantaine_id;
      v_stock_avant := coalesce(v_stock_avant, 0);
      v_stock_apres := v_stock_avant + v_qte_quarantaine;

      perform ajouter_lot(
        v_ligne.produit_id, v_entrepot_ligne, v_quarantaine_id, v_ligne.lot, v_ligne.numero_serie,
        v_ligne.date_expiration, v_date_entree, v_ligne.prix_unitaire, v_qte_quarantaine
      );

      insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
      values (v_ligne.produit_id, v_entrepot_ligne, v_quarantaine_id, v_qte_quarantaine)
      on conflict (produit_id, entrepot_id, emplacement_id)
      do update set quantite = stock_produits.quantite + excluded.quantite;

      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite,
        stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, prix_unitaire
      )
      values (
        v_entreprise_id, v_ligne.produit_id, v_entrepot_ligne, v_quarantaine_id, 'entree', v_qte_quarantaine,
        v_stock_avant, v_stock_apres, auth.uid(), v_numero, 'Non-conformité à réception - Quarantaine (' || v_numero_nc || ')',
        v_ligne.lot, v_ligne.numero_serie, v_ligne.prix_unitaire
      );

      insert into non_conformites (
        entreprise_id, numero, entrepot_id, emplacement_id, produit_id, lot, numero_serie, date_expiration,
        date_entree_lot, prix_unitaire, origine, reception_id, fournisseur_id, numero_po, motif, constat,
        quantite_initiale, quantite_restante, declare_par
      )
      values (
        v_entreprise_id, v_numero_nc, v_entrepot_ligne, v_quarantaine_id, v_ligne.produit_id, v_ligne.lot,
        v_ligne.numero_serie, v_ligne.date_expiration, v_date_entree, v_ligne.prix_unitaire, 'reception',
        p_reception_id, v_fournisseur_id, v_numero_po, coalesce(v_ligne.motif_non_conformite, 'autre'),
        v_ligne.constat_non_conformite, v_qte_quarantaine, v_qte_quarantaine, auth.uid()
      );
    end if;

    if v_ligne.quantite_recue > 0 then
      v_pmp_apres := (v_stock_total_avant * v_pmp_avant + v_ligne.quantite_recue * v_ligne.prix_unitaire)
                      / (v_stock_total_avant + v_ligne.quantite_recue);
      update produits set prix_moyen_pondere = round(v_pmp_apres, 2) where id = v_ligne.produit_id;
    end if;
  end loop;

  if v_une_ligne_anomalie then
    v_statut := 'anomalie';
  elsif v_une_ligne_incomplete then
    v_statut := 'partielle';
  else
    v_statut := 'validee';
  end if;

  update receptions set statut = v_statut, valide_par = auth.uid(), valide_le = now() where id = p_reception_id;
end;
$$;

grant execute on function valider_reception to authenticated;

-- Annule une entree en attente : aucun mouvement de stock. Motif obligatoire.
-- Autorise : l'auteur de l'entree, ou un role qui peut valider.
create function annuler_reception(p_reception_id uuid, p_motif text)
returns void
language plpgsql
security invoker
as $$
declare
  v_statut text;
  v_cree_par uuid;
begin
  if nullif(btrim(coalesce(p_motif, '')), '') is null then
    raise exception 'Le motif d''annulation est obligatoire.';
  end if;
  -- Lecture simple d'abord (messages clairs), verrou ensuite.
  select statut, cree_par into v_statut, v_cree_par from receptions where id = p_reception_id;
  if v_statut is null then
    raise exception 'Entree introuvable, ou vous ne pouvez pas la modifier.';
  end if;
  if v_statut <> 'en_attente' then
    raise exception 'Seule une entree en attente peut etre annulee.';
  end if;
  if v_cree_par <> auth.uid() and role_courant() not in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot') then
    raise exception 'Seuls l''auteur de l''entree et les responsables peuvent l''annuler.';
  end if;
  perform 1 from receptions where id = p_reception_id for update;

  update receptions
     set statut = 'annulee', annulee_par = auth.uid(), annulee_le = now(), motif_annulation = btrim(p_motif)
   where id = p_reception_id;
end;
$$;

grant execute on function annuler_reception to authenticated;

-- Modifie une entree en attente : fournisseur, note, date et lignes (les
-- lignes sont remplacees, avec les memes controles qu'a la creation). Le
-- numero est conserve. Autorise : l'auteur de l'entree, ou un role qui peut valider.
create function modifier_reception(
  p_reception_id uuid,
  p_fournisseur_id uuid,
  p_lignes jsonb,
  p_notes text default null,
  p_date_mouvement timestamptz default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_statut text;
  v_cree_par uuid;
  v_entreprise_id uuid;
  v_entrepot_principal uuid;
begin
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) = 0 then
    raise exception 'Une reception doit contenir au moins une ligne.';
  end if;
  select statut, cree_par, entreprise_id into v_statut, v_cree_par, v_entreprise_id
    from receptions where id = p_reception_id;
  if v_statut is null then
    raise exception 'Entree introuvable, ou vous ne pouvez pas la modifier.';
  end if;
  if v_statut <> 'en_attente' then
    raise exception 'Seule une entree en attente peut etre modifiee.';
  end if;
  if v_cree_par <> auth.uid() and role_courant() not in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot') then
    raise exception 'Seuls l''auteur de l''entree et les responsables peuvent la modifier.';
  end if;
  perform 1 from receptions where id = p_reception_id for update;

  v_entrepot_principal := (select e.entrepot_id from emplacements e where e.id = (p_lignes->0->>'emplacement_id')::uuid);
  if v_entrepot_principal is null then
    raise exception 'Ligne 1 : localisation introuvable ou depot non autorise.';
  end if;

  delete from receptions_lignes where reception_id = p_reception_id;
  -- Une regle de securite qui bloquerait la suppression le ferait sans erreur : on verifie.
  if exists (select 1 from receptions_lignes where reception_id = p_reception_id) then
    raise exception 'Les anciennes lignes n''ont pas pu etre remplacees.';
  end if;
  perform ajouter_lignes_reception(p_reception_id, v_entreprise_id, p_lignes);

  update receptions
     set fournisseur_id = p_fournisseur_id,
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         entrepot_id = v_entrepot_principal,
         cree_le = coalesce(p_date_mouvement, cree_le)
   where id = p_reception_id;
end;
$$;

grant execute on function modifier_reception to authenticated;

-- Commandes fournisseurs : creation (statut "fait").
-- p_lignes : tableau JSON, un objet par ligne : produit_id, quantite_commandee, prix_unitaire.
create function creer_commande_fournisseur(
  p_entrepot_id uuid,
  p_fournisseur_id uuid,
  p_lignes jsonb,
  p_date_livraison_prevue date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_commande_id uuid;
  v_ligne jsonb;
begin
  select entreprise_id into v_entreprise_id from entrepots where id = p_entrepot_id;
  if v_entreprise_id is null then
    raise exception 'Depot de livraison introuvable.';
  end if;
  if p_fournisseur_id is null then
    raise exception 'Le fournisseur est obligatoire.';
  end if;
  if p_lignes is null or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une commande doit contenir au moins une ligne.';
  end if;
  -- Controle des lignes avant de prendre un numero (pas de trou dans la numerotation).
  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    if nullif(v_ligne->>'produit_id', '') is null or coalesce((v_ligne->>'quantite_commandee')::integer, 0) <= 0 then
      raise exception 'Chaque ligne doit avoir un produit et une quantite commandee positive.';
    end if;
  end loop;

  insert into commandes_fournisseurs (
    entreprise_id, numero, fournisseur_id, entrepot_id, statut, date_livraison_prevue, notes, cree_par
  )
  values (
    v_entreprise_id,
    'PO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('commandes_fournisseurs_numero_seq')::text, 5, '0'),
    p_fournisseur_id, p_entrepot_id, 'fait', p_date_livraison_prevue, nullif(btrim(coalesce(p_notes, '')), ''), auth.uid()
  )
  returning id into v_commande_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    insert into commandes_fournisseurs_lignes (commande_id, produit_id, quantite_commandee, prix_unitaire)
    values (
      v_commande_id,
      (v_ligne->>'produit_id')::uuid,
      (v_ligne->>'quantite_commandee')::integer,
      greatest(coalesce((v_ligne->>'prix_unitaire')::numeric, 0), 0)
    );
  end loop;

  return v_commande_id;
end;
$$;

grant execute on function creer_commande_fournisseur to authenticated;

-- Commandes fournisseurs : Changements de statut manuels : Envoye, En transit.
create function changer_statut_commande(p_commande_id uuid, p_statut text)
returns void
language plpgsql
security invoker
as $$
declare
  v_statut text;
begin
  select statut into v_statut from commandes_fournisseurs where id = p_commande_id for update;
  if v_statut is null then
    raise exception 'Commande introuvable.';
  end if;

  if p_statut = 'envoye' and v_statut = 'fait' then
    update commandes_fournisseurs set statut = 'envoye', envoye_le = now() where id = p_commande_id;
  elsif p_statut = 'en_transit' and v_statut = 'envoye' then
    update commandes_fournisseurs set statut = 'en_transit', transit_le = now() where id = p_commande_id;
  else
    raise exception 'Changement de statut impossible depuis le statut actuel de la commande.';
  end if;
end;
$$;

grant execute on function changer_statut_commande to authenticated;

-- Commandes fournisseurs : Cloture manuelle (motif obligatoire).
create function cloturer_commande(p_commande_id uuid, p_motif text)
returns void
language plpgsql
security invoker
as $$
declare
  v_statut text;
begin
  select statut into v_statut from commandes_fournisseurs where id = p_commande_id for update;
  if v_statut is null then
    raise exception 'Commande introuvable.';
  end if;
  if v_statut in ('completee', 'cloturee') then
    raise exception 'Cette commande est deja terminee.';
  end if;
  if nullif(btrim(coalesce(p_motif, '')), '') is null then
    raise exception 'Le motif de cloture est obligatoire.';
  end if;

  update commandes_fournisseurs
    set statut = 'cloturee', motif_cloture = btrim(p_motif), cloturee_le = now(), cloturee_par = auth.uid()
    where id = p_commande_id;
end;
$$;

grant execute on function cloturer_commande to authenticated;

-- Commandes fournisseurs : Reception d'une commande (creee et validee en une fois).
-- p_lignes : tableau JSON, un objet par ligne recue : commande_ligne_id,
-- emplacement_id, quantite_recue, lot, numero_serie, date_expiration,
-- quantite_non_conforme, motif_non_conformite, constat_non_conformite.
create function receptionner_commande(
  p_commande_id uuid,
  p_lignes jsonb,
  p_notes text default null,
  p_date_mouvement timestamptz default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_commande commandes_fournisseurs%rowtype;
  v_reception_id uuid;
  v_date timestamptz := coalesce(p_date_mouvement, now());
  v_ligne jsonb;
  v_cl commandes_fournisseurs_lignes%rowtype;
  v_reference text;
  v_gere_expiration boolean;
  v_quantite integer;
  v_quantite_nc integer;
  v_motif_nc text;
  v_total integer := 0;
  v_reste integer;
begin
  select * into v_commande from commandes_fournisseurs where id = p_commande_id for update;
  if not found then
    raise exception 'Commande introuvable.';
  end if;
  if v_commande.statut in ('completee', 'cloturee') then
    raise exception 'Cette commande est terminee : aucune reception n''est plus possible.';
  end if;
  if v_commande.statut = 'fait' then
    raise exception 'La commande doit d''abord etre envoyee au fournisseur.';
  end if;
  if p_lignes is null or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Aucune ligne a receptionner.';
  end if;

  insert into receptions (entreprise_id, numero, entrepot_id, fournisseur_id, numero_po, statut, cree_par, notes, cree_le, commande_id)
  values (
    v_commande.entreprise_id,
    'REC-' || to_char(v_date, 'YYYY') || '-' || lpad(nextval('receptions_numero_seq')::text, 5, '0'),
    v_commande.entrepot_id, v_commande.fournisseur_id, v_commande.numero, 'en_attente', auth.uid(),
    nullif(btrim(coalesce(p_notes, '')), ''), v_date, v_commande.id
  )
  returning id into v_reception_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    select * into v_cl from commandes_fournisseurs_lignes
      where id = (v_ligne->>'commande_ligne_id')::uuid and commande_id = v_commande.id
      for update;
    if not found then
      raise exception 'Ligne de commande introuvable.';
    end if;

    v_quantite := coalesce((v_ligne->>'quantite_recue')::integer, 0);
    if v_quantite < 0 then
      raise exception 'Les quantites recues ne peuvent pas etre negatives.';
    end if;
    continue when v_quantite = 0;

    select reference, gere_expiration into v_reference, v_gere_expiration from produits where id = v_cl.produit_id;
    if nullif(v_ligne->>'emplacement_id', '') is null then
      raise exception 'Produit % : choisis l''emplacement de rangement.', v_reference;
    end if;
    if coalesce(v_gere_expiration, false) and nullif(v_ligne->>'date_expiration', '') is null then
      raise exception 'Produit % : la date d''expiration est obligatoire.', v_reference;
    end if;
    if nullif(v_ligne->>'date_expiration', '') is not null
       and nullif(v_ligne->>'lot', '') is null and nullif(v_ligne->>'numero_serie', '') is null then
      raise exception 'Produit % : le numero de lot (ou de serie) est obligatoire avec une date d''expiration.', v_reference;
    end if;

    v_quantite_nc := coalesce((v_ligne->>'quantite_non_conforme')::integer, 0);
    if v_quantite_nc < 0 or v_quantite_nc > v_quantite then
      raise exception 'Produit % : la quantite non conforme doit etre comprise entre 0 et la quantite recue.', v_reference;
    end if;
    v_motif_nc := case when v_quantite_nc > 0 then coalesce(nullif(v_ligne->>'motif_non_conformite', ''), 'autre') end;
    if v_motif_nc is not null and v_motif_nc not in ('endommage', 'avarie_transport', 'non_conforme_commande', 'surplus',
                                                     'perime', 'documents_manquants', 'defaut_qualite', 'autre') then
      raise exception 'Produit % : motif de non-conformite inconnu.', v_reference;
    end if;

    -- Attendu = reste a recevoir sur la ligne (la reception est "partielle" si on recoit moins).
    v_reste := greatest(v_cl.quantite_commandee - v_cl.quantite_recue, 0);

    insert into receptions_lignes (
      reception_id, produit_id, emplacement_id, quantite_attendue, quantite_recue, lot, numero_serie,
      date_expiration, prix_unitaire, anomalie, quantite_non_conforme, motif_non_conformite,
      constat_non_conformite, commande_ligne_id
    )
    values (
      v_reception_id, v_cl.produit_id, (v_ligne->>'emplacement_id')::uuid, v_reste, v_quantite,
      nullif(v_ligne->>'lot', ''), nullif(v_ligne->>'numero_serie', ''),
      nullif(v_ligne->>'date_expiration', '')::date, v_cl.prix_unitaire, v_quantite_nc > 0, v_quantite_nc,
      v_motif_nc, case when v_quantite_nc > 0 then nullif(btrim(v_ligne->>'constat_non_conformite'), '') end, v_cl.id
    );

    update commandes_fournisseurs_lignes set quantite_recue = quantite_recue + v_quantite where id = v_cl.id;
    v_total := v_total + v_quantite;
  end loop;

  if v_total = 0 then
    raise exception 'Saisis au moins une quantite recue.';
  end if;

  -- Stock, lots, PMP, quarantaine : validation existante.
  perform valider_reception(v_reception_id);

  update commandes_fournisseurs c
    set statut = case
          when not exists (
            select 1 from commandes_fournisseurs_lignes l
            where l.commande_id = c.id and l.quantite_recue < l.quantite_commandee
          ) then 'completee'
          else 'en_cours_reception'
        end,
        completee_le = case
          when not exists (
            select 1 from commandes_fournisseurs_lignes l
            where l.commande_id = c.id and l.quantite_recue < l.quantite_commandee
          ) then now()
        end
    where c.id = v_commande.id;

  return v_reception_id;
end;
$$;

grant execute on function receptionner_commande to authenticated;

-- Cree une sortie (panier de plusieurs produits) en une seule transaction :
-- verifie et decremente le stock de chaque ligne (verrou sur la ligne de
-- stock concernee), insere les mouvements 'sortie', cree le bon au statut
-- 'confirmee' directement (pas d'etape de validation separee, contrairement
-- aux receptions). Numerotation BS-<annee>-<sequence>.
-- p_lignes : produit_id, emplacement_id, quantite et (optionnel)
-- stock_lot_id. Sans stock_lot_id, les lots sont consommes automatiquement
-- dans l'ordre FEFO / FIFO. Un lot perime ne sort qu'avec une note.
create function creer_sortie(
  p_entrepot_id uuid,
  p_motif text,
  p_lignes jsonb,
  p_date_mouvement timestamptz default null,
  p_recu_par text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_bon_id uuid;
  v_numero text;
  v_date timestamptz;
  v_ligne jsonb;
  v_produit_id uuid;
  v_emplacement_id uuid;
  v_quantite integer;
  v_stock_avant integer;
  v_stock_apres integer;
  v_stock_lot_id uuid;
  v_lot stock_lots%rowtype;
  v_entrepot_principal uuid;
  v_entrepot_ligne uuid;
begin
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) = 0 then
    raise exception 'Une sortie doit contenir au moins une ligne.';
  end if;
  -- Une sortie peut prendre des produits dans plusieurs depots : le depot de
  -- chaque ligne est celui de sa localisation. L'en-tete garde un depot
  -- "principal" (celui passe en parametre, sinon celui de la premiere ligne).
  v_entrepot_principal := coalesce(
    p_entrepot_id,
    (select e.entrepot_id from emplacements e where e.id = (p_lignes->0->>'emplacement_id')::uuid)
  );
  select entreprise_id into v_entreprise_id from entrepots where id = v_entrepot_principal;
  if v_entreprise_id is null then
    raise exception 'Ligne 1 : localisation introuvable ou depot non autorise.';
  end if;
  -- Une sortie est toujours destinée à quelqu'un (une personne, ou un service : Logistique...).
  if nullif(btrim(coalesce(p_recu_par, '')), '') is null then
    raise exception 'Le champ « Reçu par » est obligatoire : indique qui reçoit la sortie (une personne ou un service).';
  end if;

  v_date := coalesce(p_date_mouvement, now());
  v_numero := 'BS-' || to_char(v_date, 'YYYY') || '-' || lpad(nextval('bons_sortie_numero_seq')::text, 5, '0');

  insert into bons_sortie (entreprise_id, numero, entrepot_id, demande_par, statut, motif, recu_par, cree_le)
  values (
    v_entreprise_id, v_numero, v_entrepot_principal, auth.uid(), 'confirmee', nullif(p_motif, ''), nullif(btrim(p_recu_par), ''), v_date
  )
  returning id into v_bon_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    v_produit_id := (v_ligne->>'produit_id')::uuid;
    v_emplacement_id := (v_ligne->>'emplacement_id')::uuid;
    v_quantite := (v_ligne->>'quantite')::integer;
    v_stock_lot_id := nullif(v_ligne->>'stock_lot_id', '')::uuid;
    v_lot := null;

    if v_produit_id is null or v_emplacement_id is null or v_quantite is null or v_quantite <= 0 then
      raise exception 'Ligne de sortie invalide (produit, emplacement et quantite requis).';
    end if;

    select e.entrepot_id into v_entrepot_ligne from emplacements e where e.id = v_emplacement_id;
    -- Une localisation d'un depot non attribue est invisible (securite) : meme message.
    if v_entrepot_ligne is null then
      raise exception 'Localisation introuvable ou depot non autorise.';
    end if;
    if v_entrepot_ligne not in (select entrepots_visibles()) then
      raise exception 'Vous n''avez pas acces au depot de cette localisation.';
    end if;
    if not exists (select 1 from entrepots where id = v_entrepot_ligne and entreprise_id = v_entreprise_id) then
      raise exception 'Le depot n''appartient pas a votre entreprise.';
    end if;

    select quantite into v_stock_avant from stock_produits
      where produit_id = v_produit_id and entrepot_id = v_entrepot_ligne and emplacement_id = v_emplacement_id
      for update;

    if v_stock_avant is null or v_stock_avant < v_quantite then
      raise exception 'Stock insuffisant pour ce produit a cet emplacement.';
    end if;

    -- Le lot d'abord, le stock ensuite (voir synchroniser_lots).
    if v_stock_lot_id is not null then
      select * into v_lot from stock_lots
        where id = v_stock_lot_id and produit_id = v_produit_id
          and entrepot_id = v_entrepot_ligne and emplacement_id = v_emplacement_id
        for update;

      if not found or v_lot.quantite < v_quantite then
        raise exception 'Stock insuffisant dans le lot choisi.';
      end if;
      if v_lot.date_expiration is not null and v_lot.date_expiration < v_date::date
         and nullif(btrim(coalesce(p_motif, '')), '') is null then
        raise exception 'Lot perime : une note est obligatoire pour le sortir (ex. mise au rebut).';
      end if;

      if v_lot.quantite = v_quantite then
        delete from stock_lots where id = v_lot.id;
      else
        update stock_lots set quantite = quantite - v_quantite where id = v_lot.id;
      end if;
    end if;

    v_stock_apres := v_stock_avant - v_quantite;
    if v_stock_apres = 0 then
      delete from stock_produits
        where produit_id = v_produit_id and entrepot_id = v_entrepot_ligne and emplacement_id = v_emplacement_id;
    else
      update stock_produits set quantite = v_stock_apres
        where produit_id = v_produit_id and entrepot_id = v_entrepot_ligne and emplacement_id = v_emplacement_id;
    end if;

    insert into bons_sortie_lignes (
      bon_sortie_id, produit_id, emplacement_id, quantite, lot, numero_serie, date_expiration, date_entree_lot
    )
    values (
      v_bon_id, v_produit_id, v_emplacement_id, v_quantite,
      v_lot.lot, v_lot.numero_serie, v_lot.date_expiration, v_lot.date_entree
    );

    insert into mouvements_stock (
      entreprise_id, produit_id, entrepot_id, emplacement_id,
      type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, cree_le
    )
    values (
      v_entreprise_id, v_produit_id, v_entrepot_ligne, v_emplacement_id,
      'sortie', v_quantite, v_stock_avant, v_stock_apres, auth.uid(), v_numero, p_motif,
      v_lot.lot, v_lot.numero_serie, v_date
    );
  end loop;

  return v_bon_id;
end;
$$;

grant execute on function creer_sortie to authenticated;

-- Cree une reintegration (panier) : chaque ligne cible une bons_sortie_lignes
-- precise (verrouillee via for update le temps de la transaction), verifie
-- que la quantite demandee ne depasse pas son solde "sorti - deja
-- reintegre sur cette ligne", incremente le stock, insere un mouvement
-- 'reintegration'. L'operation de sortie d'origine n'est jamais modifiee
-- ni supprimee, seule une nouvelle ecriture compense.
create function creer_reintegration(
  p_entrepot_id uuid,
  p_notes text,
  p_lignes jsonb,
  p_date_mouvement timestamptz default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_reintegration_id uuid;
  v_numero text;
  v_date timestamptz;
  v_ligne jsonb;
  v_bon_sortie_ligne_id uuid;
  v_emplacement_id uuid;
  v_quantite integer;
  v_notes_ligne text;
  v_ligne_produit_id uuid;
  v_ligne_entrepot_id uuid;
  v_ligne_quantite_sortie integer;
  v_ligne_lot text;
  v_ligne_numero_serie text;
  v_ligne_date_expiration date;
  v_ligne_date_entree timestamptz;
  v_total_reintegre integer;
  v_disponible integer;
  v_stock_avant integer;
  v_stock_apres integer;
begin
  select entreprise_id into v_entreprise_id from entrepots where id = p_entrepot_id;
  if v_entreprise_id is null then
    raise exception 'Entrepot introuvable.';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une reintegration doit contenir au moins une ligne.';
  end if;

  v_date := coalesce(p_date_mouvement, now());
  v_numero := 'REINT-' || to_char(v_date, 'YYYY') || '-' || lpad(nextval('reintegrations_numero_seq')::text, 5, '0');

  insert into reintegrations (entreprise_id, numero, entrepot_id, demande_par, notes, cree_le)
  values (v_entreprise_id, v_numero, p_entrepot_id, auth.uid(), nullif(p_notes, ''), v_date)
  returning id into v_reintegration_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    v_bon_sortie_ligne_id := (v_ligne->>'bon_sortie_ligne_id')::uuid;
    v_emplacement_id := (v_ligne->>'emplacement_id')::uuid;
    v_quantite := (v_ligne->>'quantite')::integer;
    v_notes_ligne := nullif(v_ligne->>'notes', '');

    if v_bon_sortie_ligne_id is null or v_emplacement_id is null or v_quantite is null or v_quantite <= 0 then
      raise exception 'Ligne de reintegration invalide (ligne de sortie, emplacement et quantite requis).';
    end if;

    v_ligne_produit_id := null;
    -- Depot d'ou la ligne est sortie : celui de sa localisation (une sortie
    -- peut couvrir plusieurs depots), a defaut celui de l'en-tete du bon.
    select bsl.produit_id, coalesce(es.entrepot_id, bs.entrepot_id), bsl.quantite, bsl.lot, bsl.numero_serie,
           bsl.date_expiration, bsl.date_entree_lot
      into v_ligne_produit_id, v_ligne_entrepot_id, v_ligne_quantite_sortie,
           v_ligne_lot, v_ligne_numero_serie, v_ligne_date_expiration, v_ligne_date_entree
      from bons_sortie_lignes bsl
      join bons_sortie bs on bs.id = bsl.bon_sortie_id
      left join emplacements es on es.id = bsl.emplacement_id
      where bsl.id = v_bon_sortie_ligne_id and bs.statut = 'confirmee'
      for update of bsl;

    if v_ligne_produit_id is null then
      raise exception 'Ligne de sortie introuvable ou non confirmee.';
    end if;
    if v_ligne_entrepot_id <> p_entrepot_id then
      raise exception 'Cette ligne de sortie appartient a un autre entrepot.';
    end if;

    select coalesce(sum(rl.quantite), 0) into v_total_reintegre
      from reintegrations_lignes rl
      where rl.bon_sortie_ligne_id = v_bon_sortie_ligne_id;

    v_disponible := v_ligne_quantite_sortie - v_total_reintegre;
    if v_quantite > v_disponible then
      raise exception 'Quantite a reintegrer superieure au solde disponible pour cette ligne de sortie.';
    end if;

    select quantite into v_stock_avant from stock_produits
      where produit_id = v_ligne_produit_id and entrepot_id = p_entrepot_id and emplacement_id = v_emplacement_id;
    v_stock_avant := coalesce(v_stock_avant, 0);
    v_stock_apres := v_stock_avant + v_quantite;

    -- Le lot d'abord, le stock ensuite (voir synchroniser_lots) : la
    -- quantite retrouve son lot d'origine (ou un lot "sans lot" date du jour
    -- pour les sorties anterieures au suivi par lot).
    perform ajouter_lot(
      v_ligne_produit_id, p_entrepot_id, v_emplacement_id, v_ligne_lot, v_ligne_numero_serie,
      v_ligne_date_expiration, coalesce(v_ligne_date_entree, v_date), null, v_quantite
    );

    insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
    values (v_ligne_produit_id, p_entrepot_id, v_emplacement_id, v_quantite)
    on conflict (produit_id, entrepot_id, emplacement_id)
    do update set quantite = stock_produits.quantite + excluded.quantite;

    insert into reintegrations_lignes (reintegration_id, bon_sortie_ligne_id, produit_id, emplacement_id, quantite, notes)
    values (v_reintegration_id, v_bon_sortie_ligne_id, v_ligne_produit_id, v_emplacement_id, v_quantite, v_notes_ligne);

    insert into mouvements_stock (
      entreprise_id, produit_id, entrepot_id, emplacement_id,
      type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, cree_le
    )
    values (
      v_entreprise_id, v_ligne_produit_id, p_entrepot_id, v_emplacement_id,
      'reintegration', v_quantite, v_stock_avant, v_stock_apres, auth.uid(), v_numero, v_notes_ligne,
      v_ligne_lot, v_ligne_numero_serie, v_date
    );
  end loop;

  return v_reintegration_id;
end;
$$;

grant execute on function creer_reintegration to authenticated;

-- Transferts entre entrepots : cycle de vie en 4 etapes RPC distinctes
-- (demande -> validation -> expedition -> reception), chacune verifiant
-- le statut courant du transfert (verrouille via for update) avant de
-- l'avancer. Le stock ne bouge qu'a l'expedition (decrement source) et a
-- la reception (increment destination) ; demande et validation ne sont
-- que des changements de statut.

create function demander_transfert(
  p_entrepot_source_id uuid,
  p_entrepot_destination_id uuid,
  p_lignes jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_transfert_id uuid;
  v_numero text;
  v_ligne jsonb;
  v_produit_id uuid;
  v_quantite integer;
begin
  if p_entrepot_source_id = p_entrepot_destination_id then
    raise exception 'L''entrepot source et destination doivent etre differents.';
  end if;
  select entreprise_id into v_entreprise_id from entrepots where id = p_entrepot_source_id;
  if v_entreprise_id is null then
    raise exception 'Entrepot source introuvable.';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Un transfert doit contenir au moins une ligne.';
  end if;

  v_numero := 'TRF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('transferts_numero_seq')::text, 5, '0');

  insert into transferts (entreprise_id, numero_suivi, entrepot_source_id, entrepot_destination_id, demande_par, statut)
  values (v_entreprise_id, v_numero, p_entrepot_source_id, p_entrepot_destination_id, auth.uid(), 'demande')
  returning id into v_transfert_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    v_produit_id := (v_ligne->>'produit_id')::uuid;
    v_quantite := (v_ligne->>'quantite')::integer;

    if v_produit_id is null or v_quantite is null or v_quantite <= 0 then
      raise exception 'Ligne de transfert invalide (produit et quantite requis).';
    end if;

    insert into transferts_lignes (transfert_id, produit_id, quantite_expediee)
    values (v_transfert_id, v_produit_id, v_quantite);
  end loop;

  return v_transfert_id;
end;
$$;

grant execute on function demander_transfert to authenticated;

create function valider_transfert(p_transfert_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_statut text;
begin
  select statut into v_statut from transferts where id = p_transfert_id for update;
  if v_statut is null then
    raise exception 'Transfert introuvable.';
  end if;
  if v_statut <> 'demande' then
    raise exception 'Seul un transfert au statut "demande" peut etre valide.';
  end if;

  update transferts set statut = 'valide', valide_par = auth.uid() where id = p_transfert_id;
end;
$$;

grant execute on function valider_transfert to authenticated;

-- Expedie un transfert valide : pour chaque ligne, verifie et decremente le
-- stock a l'emplacement source choisi (verrou), passe le transfert
-- directement au statut 'en_transit' (l'etat 'expedie' est instantane, pas
-- une etape separee dans ce MVP).
create function expedier_transfert(
  p_transfert_id uuid,
  p_lignes jsonb,
  p_date_mouvement timestamptz default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_entrepot_source_id uuid;
  v_statut text;
  v_numero text;
  v_date timestamptz;
  v_ligne jsonb;
  v_transfert_ligne_id uuid;
  v_emplacement_id uuid;
  v_ligne_produit_id uuid;
  v_ligne_quantite integer;
  v_stock_avant integer;
  v_stock_apres integer;
begin
  select entreprise_id, entrepot_source_id, statut, numero_suivi
    into v_entreprise_id, v_entrepot_source_id, v_statut, v_numero
    from transferts where id = p_transfert_id for update;
  if v_statut is null then
    raise exception 'Transfert introuvable.';
  end if;
  if v_statut <> 'valide' then
    raise exception 'Seul un transfert au statut "valide" peut etre expedie.';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Aucune ligne a expedier.';
  end if;

  v_date := coalesce(p_date_mouvement, now());

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    v_transfert_ligne_id := (v_ligne->>'transfert_ligne_id')::uuid;
    v_emplacement_id := (v_ligne->>'emplacement_source_id')::uuid;

    if v_transfert_ligne_id is null or v_emplacement_id is null then
      raise exception 'Ligne d''expedition invalide (ligne de transfert et emplacement requis).';
    end if;

    select produit_id, quantite_expediee into v_ligne_produit_id, v_ligne_quantite
      from transferts_lignes where id = v_transfert_ligne_id and transfert_id = p_transfert_id;
    if v_ligne_produit_id is null then
      raise exception 'Ligne de transfert introuvable.';
    end if;

    select quantite into v_stock_avant from stock_produits
      where produit_id = v_ligne_produit_id and entrepot_id = v_entrepot_source_id and emplacement_id = v_emplacement_id
      for update;

    if v_stock_avant is null or v_stock_avant < v_ligne_quantite then
      raise exception 'Stock insuffisant pour ce produit a cet emplacement source.';
    end if;

    v_stock_apres := v_stock_avant - v_ligne_quantite;
    if v_stock_apres = 0 then
      delete from stock_produits
        where produit_id = v_ligne_produit_id and entrepot_id = v_entrepot_source_id and emplacement_id = v_emplacement_id;
    else
      update stock_produits set quantite = v_stock_apres
        where produit_id = v_ligne_produit_id and entrepot_id = v_entrepot_source_id and emplacement_id = v_emplacement_id;
    end if;

    update transferts_lignes set emplacement_source_id = v_emplacement_id where id = v_transfert_ligne_id;

    insert into mouvements_stock (
      entreprise_id, produit_id, entrepot_id, emplacement_id,
      type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, cree_le
    )
    values (
      v_entreprise_id, v_ligne_produit_id, v_entrepot_source_id, v_emplacement_id,
      'transfert', v_ligne_quantite, v_stock_avant, v_stock_apres, auth.uid(), v_numero, 'Expedition transfert', v_date
    );
  end loop;

  update transferts set statut = 'en_transit', expedie_le = v_date where id = p_transfert_id;
end;
$$;

grant execute on function expedier_transfert to authenticated;

-- Receptionne un transfert en transit : pour chaque ligne, incremente le
-- stock a l'emplacement destination choisi, enregistre la quantite
-- reellement recue (l'ecart avec la quantite expediee reste visible par
-- comparaison, aucun mouvement d'ajustement n'est genere automatiquement).
create function receptionner_transfert(
  p_transfert_id uuid,
  p_lignes jsonb,
  p_date_mouvement timestamptz default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_entreprise_id uuid;
  v_entrepot_destination_id uuid;
  v_statut text;
  v_numero text;
  v_date timestamptz;
  v_ligne jsonb;
  v_transfert_ligne_id uuid;
  v_emplacement_id uuid;
  v_quantite_recue integer;
  v_ligne_produit_id uuid;
  v_stock_avant integer;
  v_stock_apres integer;
begin
  select entreprise_id, entrepot_destination_id, statut, numero_suivi
    into v_entreprise_id, v_entrepot_destination_id, v_statut, v_numero
    from transferts where id = p_transfert_id for update;
  if v_statut is null then
    raise exception 'Transfert introuvable.';
  end if;
  if v_statut <> 'en_transit' then
    raise exception 'Seul un transfert au statut "en_transit" peut etre receptionne.';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Aucune ligne a receptionner.';
  end if;

  v_date := coalesce(p_date_mouvement, now());

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    v_transfert_ligne_id := (v_ligne->>'transfert_ligne_id')::uuid;
    v_emplacement_id := (v_ligne->>'emplacement_destination_id')::uuid;
    v_quantite_recue := (v_ligne->>'quantite_recue')::integer;

    if v_transfert_ligne_id is null or v_emplacement_id is null or v_quantite_recue is null or v_quantite_recue < 0 then
      raise exception 'Ligne de reception invalide (ligne de transfert, emplacement et quantite recue requis).';
    end if;

    select produit_id into v_ligne_produit_id
      from transferts_lignes where id = v_transfert_ligne_id and transfert_id = p_transfert_id;
    if v_ligne_produit_id is null then
      raise exception 'Ligne de transfert introuvable.';
    end if;

    select quantite into v_stock_avant from stock_produits
      where produit_id = v_ligne_produit_id and entrepot_id = v_entrepot_destination_id and emplacement_id = v_emplacement_id;
    v_stock_avant := coalesce(v_stock_avant, 0);
    v_stock_apres := v_stock_avant + v_quantite_recue;

    if v_quantite_recue > 0 then
      insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
      values (v_ligne_produit_id, v_entrepot_destination_id, v_emplacement_id, v_quantite_recue)
      on conflict (produit_id, entrepot_id, emplacement_id)
      do update set quantite = stock_produits.quantite + excluded.quantite;
    end if;

    update transferts_lignes
      set emplacement_destination_id = v_emplacement_id, quantite_recue = v_quantite_recue
      where id = v_transfert_ligne_id;

    if v_quantite_recue > 0 then
      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id,
        type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, cree_le
      )
      values (
        v_entreprise_id, v_ligne_produit_id, v_entrepot_destination_id, v_emplacement_id,
        'transfert', v_quantite_recue, v_stock_avant, v_stock_apres, auth.uid(), v_numero, 'Reception transfert', v_date
      );
    end if;
  end loop;

  update transferts set statut = 'recu', recu_le = v_date where id = p_transfert_id;
end;
$$;

grant execute on function receptionner_transfert to authenticated;

-- ============================================================
-- 4. VUES POUR LE DASHBOARD
-- ============================================================
-- security_invoker = true : la vue applique les policies RLS de
-- l'utilisateur qui interroge, pas celles du createur de la vue.
-- Le stock place en Quarantaine est exclu du stock disponible (cahier des
-- charges, section 5).
-- Stock d'alerte = seuil de reapprovisionnement (point de commande) ; a
-- defaut de seuil renseigne sur le produit, on retombe sur le stock minimum.
-- Le statut 'faible' signifie donc "en alerte" (stock <= stock d'alerte).

create view v_produits_stock with (security_invoker = true) as
select
  p.*,
  c.nom as categorie_nom,
  coalesce(sum(case when e.est_quarantaine then 0 else s.quantite end), 0)::int as stock_actuel,
  case
    when coalesce(sum(case when e.est_quarantaine then 0 else s.quantite end), 0) = 0 then 'rupture'
    when coalesce(sum(case when e.est_quarantaine then 0 else s.quantite end), 0)
      <= coalesce(p.seuil_reappro, p.stock_min) then 'faible'
    else 'normal'
  end as statut
from produits p
left join categories c on c.id = p.categorie_id
left join stock_produits s on s.produit_id = p.id
left join emplacements e on e.id = s.emplacement_id
group by p.id, c.nom;

create view v_mouvements_recents with (security_invoker = true) as
select
  m.*,
  p.designation as produit_designation,
  pr.nom_complet as utilisateur_nom
from mouvements_stock m
join produits p on p.id = m.produit_id
join profiles pr on pr.id = m.utilisateur_id;

create view v_stock_par_entrepot with (security_invoker = true) as
select
  ent.id as entrepot_id,
  ent.nom as entrepot_nom,
  count(distinct case when not e.est_quarantaine then s.produit_id end)::int as nb_produits,
  coalesce(sum(case when e.est_quarantaine then 0 else s.quantite end), 0)::int as quantite_totale,
  count(distinct case when not e.est_quarantaine and s.quantite = 0 then s.produit_id end)::int as nb_rupture,
  count(distinct case
    when not e.est_quarantaine and s.quantite > 0 and s.quantite <= coalesce(p.seuil_reappro, p.stock_min)
      then s.produit_id
  end)::int as nb_stock_faible
from entrepots ent
left join stock_produits s on s.entrepot_id = ent.id
left join emplacements e on e.id = s.emplacement_id
left join produits p on p.id = s.produit_id
group by ent.id, ent.nom;

-- "En commande" (colonne Commande des ecrans Produits et Alertes stock) : receptions manuelles en attente + reliquats des commandes en cours.
drop view if exists v_produits_commandes;
create view v_produits_commandes with (security_invoker = true) as
select produit_id, sum(quantite)::int as quantite_commandee
from (
  select rl.produit_id, (rl.quantite_attendue - rl.quantite_recue) as quantite
  from receptions_lignes rl
  join receptions r on r.id = rl.reception_id
  where r.statut in ('en_attente', 'partielle') and r.commande_id is null
  union all
  select cl.produit_id, greatest(cl.quantite_commandee - cl.quantite_recue, 0)
  from commandes_fournisseurs_lignes cl
  join commandes_fournisseurs c on c.id = cl.commande_id
  where c.statut in ('fait', 'envoye', 'en_transit', 'en_cours_reception')
) t
group by produit_id;

-- Lignes de sortie confirmees encore partiellement/totalement reintegrables
-- (solde = quantite de la ligne moins deja reintegre sur cette ligne
-- precise), ne montre que les lignes avec un solde positif. Alimente le
-- "Detail des sorties" de la fenetre Reintegration (une ligne = une sortie
-- precise, reintegrable independamment des autres lignes du meme bon).
create view v_sorties_a_reintegrer with (security_invoker = true) as
select
  bsl.id as bon_sortie_ligne_id,
  bsl.produit_id,
  p.reference as produit_reference,
  p.designation as produit_designation,
  coalesce(es.entrepot_id, bs.entrepot_id) as entrepot_id,
  bs.numero as bon_sortie_numero,
  bs.motif,
  bs.cree_le as sortie_le,
  bsl.quantite as quantite_sortie,
  coalesce(reint.quantite_reintegree, 0)::int as quantite_reintegree,
  (bsl.quantite - coalesce(reint.quantite_reintegree, 0))::int as quantite_disponible
from bons_sortie_lignes bsl
join bons_sortie bs on bs.id = bsl.bon_sortie_id
left join emplacements es on es.id = bsl.emplacement_id
join produits p on p.id = bsl.produit_id
left join (
  select bon_sortie_ligne_id, sum(quantite) as quantite_reintegree
  from reintegrations_lignes
  group by bon_sortie_ligne_id
) reint on reint.bon_sortie_ligne_id = bsl.id
where bs.statut = 'confirmee'
  and bsl.quantite - coalesce(reint.quantite_reintegree, 0) > 0;

-- ------------------------------------------------------------
-- Vues de l'Historique (lecture seule, securite de l'utilisateur appliquee)
-- ------------------------------------------------------------

-- Bons de sortie : un par ligne, avec dépôt, émetteur et totaux.
create view v_historique_sorties with (security_invoker = true) as
select
  bs.id,
  bs.numero,
  bs.entrepot_id,
  e.nom as entrepot_nom,
  bs.statut,
  bs.motif,
  bs.recu_par,
  bs.demande_par,
  pr.nom_complet as emis_par_nom,
  bs.cree_le,
  coalesce(l.nb_lignes, 0)::int as nb_lignes,
  coalesce(l.quantite_totale, 0)::int as quantite_totale,
  coalesce(r.quantite_reintegree, 0)::int as quantite_reintegree
from bons_sortie bs
join entrepots e on e.id = bs.entrepot_id
left join profiles pr on pr.id = bs.demande_par
left join (
  select bon_sortie_id, count(*) as nb_lignes, sum(quantite) as quantite_totale
  from bons_sortie_lignes group by bon_sortie_id
) l on l.bon_sortie_id = bs.id
left join (
  select bsl.bon_sortie_id, sum(rl.quantite) as quantite_reintegree
  from reintegrations_lignes rl
  join bons_sortie_lignes bsl on bsl.id = rl.bon_sortie_ligne_id
  group by bsl.bon_sortie_id
) r on r.bon_sortie_id = bs.id;

create view v_historique_sorties_lignes with (security_invoker = true) as
select
  bsl.id,
  bsl.bon_sortie_id,
  bsl.produit_id,
  p.reference as produit_reference,
  p.designation as produit_designation,
  p.unite_mesure,
  bsl.emplacement_id,
  em.code as emplacement_code,
  bsl.lot,
  bsl.numero_serie,
  bsl.date_expiration,
  bsl.quantite,
  coalesce(r.quantite_reintegree, 0)::int as quantite_reintegree
from bons_sortie_lignes bsl
join produits p on p.id = bsl.produit_id
left join emplacements em on em.id = bsl.emplacement_id
left join (
  select bon_sortie_ligne_id, sum(quantite) as quantite_reintegree
  from reintegrations_lignes group by bon_sortie_ligne_id
) r on r.bon_sortie_ligne_id = bsl.id;

-- Réceptions (entrées).
create view v_historique_entrees with (security_invoker = true) as
select
  r.id,
  r.numero,
  r.entrepot_id,
  e.nom as entrepot_nom,
  r.fournisseur_id,
  f.nom as fournisseur_nom,
  r.numero_po,
  r.statut,
  r.notes,
  r.cree_par,
  pc.nom_complet as cree_par_nom,
  r.valide_par,
  pv.nom_complet as valide_par_nom,
  r.valide_le,
  r.cree_le,
  coalesce(l.nb_lignes, 0)::int as nb_lignes,
  coalesce(l.quantite_attendue, 0)::int as quantite_attendue,
  coalesce(l.quantite_recue, 0)::int as quantite_recue
from receptions r
join entrepots e on e.id = r.entrepot_id
left join fournisseurs f on f.id = r.fournisseur_id
left join profiles pc on pc.id = r.cree_par
left join profiles pv on pv.id = r.valide_par
left join (
  select reception_id, count(*) as nb_lignes, sum(quantite_attendue) as quantite_attendue, sum(quantite_recue) as quantite_recue
  from receptions_lignes group by reception_id
) l on l.reception_id = r.id;

create view v_historique_entrees_lignes with (security_invoker = true) as
select
  rl.id,
  rl.reception_id,
  rl.produit_id,
  p.reference as produit_reference,
  p.designation as produit_designation,
  p.unite_mesure,
  rl.emplacement_id,
  em.code as emplacement_code,
  rl.lot,
  rl.numero_serie,
  rl.date_expiration,
  rl.quantite_attendue,
  rl.quantite_recue,
  rl.anomalie
from receptions_lignes rl
join produits p on p.id = rl.produit_id
left join emplacements em on em.id = rl.emplacement_id;

-- Réintégrations.
create view v_historique_reintegrations with (security_invoker = true) as
select
  ri.id,
  ri.numero,
  ri.entrepot_id,
  e.nom as entrepot_nom,
  ri.notes,
  ri.demande_par,
  pr.nom_complet as emis_par_nom,
  ri.cree_le,
  coalesce(l.nb_lignes, 0)::int as nb_lignes,
  coalesce(l.quantite_totale, 0)::int as quantite_totale
from reintegrations ri
join entrepots e on e.id = ri.entrepot_id
left join profiles pr on pr.id = ri.demande_par
left join (
  select reintegration_id, count(*) as nb_lignes, sum(quantite) as quantite_totale
  from reintegrations_lignes group by reintegration_id
) l on l.reintegration_id = ri.id;

create view v_historique_reintegrations_lignes with (security_invoker = true) as
select
  rl.id,
  rl.reintegration_id,
  rl.produit_id,
  p.reference as produit_reference,
  p.designation as produit_designation,
  p.unite_mesure,
  rl.emplacement_id,
  em.code as emplacement_code,
  bsl.lot,
  bsl.numero_serie,
  bsl.date_expiration,
  bs.numero as bon_sortie_numero,
  rl.quantite,
  rl.notes
from reintegrations_lignes rl
join produits p on p.id = rl.produit_id
left join emplacements em on em.id = rl.emplacement_id
left join bons_sortie_lignes bsl on bsl.id = rl.bon_sortie_ligne_id
left join bons_sortie bs on bs.id = bsl.bon_sortie_id;

-- Transferts.
create view v_historique_transferts with (security_invoker = true) as
select
  t.id,
  t.numero_suivi as numero,
  t.entrepot_source_id,
  es.nom as entrepot_source_nom,
  t.entrepot_destination_id,
  ed.nom as entrepot_destination_nom,
  t.statut,
  t.demande_par,
  pr.nom_complet as emis_par_nom,
  t.cree_le,
  t.expedie_le,
  t.recu_le,
  coalesce(l.nb_lignes, 0)::int as nb_lignes,
  coalesce(l.quantite_expediee, 0)::int as quantite_expediee,
  coalesce(l.quantite_recue, 0)::int as quantite_recue
from transferts t
join entrepots es on es.id = t.entrepot_source_id
join entrepots ed on ed.id = t.entrepot_destination_id
left join profiles pr on pr.id = t.demande_par
left join (
  select transfert_id, count(*) as nb_lignes, sum(quantite_expediee) as quantite_expediee, sum(quantite_recue) as quantite_recue
  from transferts_lignes group by transfert_id
) l on l.transfert_id = t.id;

create view v_historique_transferts_lignes with (security_invoker = true) as
select
  tl.id,
  tl.transfert_id,
  tl.produit_id,
  p.reference as produit_reference,
  p.designation as produit_designation,
  p.unite_mesure,
  es.code as emplacement_source_code,
  ed.code as emplacement_destination_code,
  tl.quantite_expediee,
  tl.quantite_recue
from transferts_lignes tl
join produits p on p.id = tl.produit_id
left join emplacements es on es.id = tl.emplacement_source_id
left join emplacements ed on ed.id = tl.emplacement_destination_id;

-- Tous les mouvements, avec dépôt, emplacement et opérateur.
create view v_historique_mouvements with (security_invoker = true) as
select
  m.id,
  m.cree_le,
  m.type,
  m.reference,
  m.produit_id,
  p.reference as produit_reference,
  p.designation as produit_designation,
  m.entrepot_id,
  e.nom as entrepot_nom,
  em.code as emplacement_code,
  eo.code as emplacement_origine_code,
  m.quantite,
  m.stock_avant,
  m.stock_apres,
  m.lot,
  m.numero_serie,
  m.motif,
  m.utilisateur_id,
  pr.nom_complet as utilisateur_nom
from mouvements_stock m
join produits p on p.id = m.produit_id
join entrepots e on e.id = m.entrepot_id
left join emplacements em on em.id = m.emplacement_id
left join emplacements eo on eo.id = m.emplacement_origine_id
left join profiles pr on pr.id = m.utilisateur_id;

-- Quarantaine : dossiers de non-conformite enrichis, et leurs traitements.
create view v_quarantaine with (security_invoker = true) as
select
  nc.*,
  p.reference as produit_reference,
  p.designation as produit_designation,
  p.unite_mesure,
  e.nom as entrepot_nom,
  em.code as emplacement_code,
  f.nom as fournisseur_nom,
  r.numero as reception_numero,
  pr.nom_complet as declare_par_nom,
  (current_date - nc.cree_le::date)::int as age_jours,
  round(nc.quantite_restante * coalesce(nc.prix_unitaire, p.prix_moyen_pondere, 0), 2) as valeur_bloquee,
  coalesce(t.nb_traitements, 0)::int as nb_traitements,
  t.dernier_traitement_le
from non_conformites nc
join produits p on p.id = nc.produit_id
join entrepots e on e.id = nc.entrepot_id
left join emplacements em on em.id = nc.emplacement_id
left join fournisseurs f on f.id = nc.fournisseur_id
left join receptions r on r.id = nc.reception_id
left join profiles pr on pr.id = nc.declare_par
left join (
  select non_conformite_id, count(*) as nb_traitements, max(cree_le) as dernier_traitement_le
  from non_conformites_traitements group by non_conformite_id
) t on t.non_conformite_id = nc.id;

create view v_quarantaine_traitements with (security_invoker = true) as
select
  t.*,
  nc.numero as non_conformite_numero,
  em.code as emplacement_destination_code,
  pr.nom_complet as traite_par_nom
from non_conformites_traitements t
join non_conformites nc on nc.id = t.non_conformite_id
left join emplacements em on em.id = t.emplacement_destination_id
left join profiles pr on pr.id = t.traite_par;

-- Commandes fournisseurs enrichies (fournisseur, depot, quantites, montant, % recu) et leurs lignes.
create view v_commandes_fournisseurs with (security_invoker = true) as
select
  c.*,
  f.nom as fournisseur_nom,
  e.nom as entrepot_nom,
  pr.nom_complet as cree_par_nom,
  coalesce(l.nb_lignes, 0)::int as nb_lignes,
  coalesce(l.quantite_commandee, 0)::int as quantite_commandee,
  coalesce(l.quantite_recue, 0)::int as quantite_recue,
  coalesce(l.montant, 0)::numeric(14, 2) as montant,
  case when coalesce(l.quantite_commandee, 0) = 0 then 0
       else least(100, round(100.0 * l.quantite_recue / l.quantite_commandee))::int end as pourcentage_recu,
  coalesce(r.nb_receptions, 0)::int as nb_receptions
from commandes_fournisseurs c
join fournisseurs f on f.id = c.fournisseur_id
join entrepots e on e.id = c.entrepot_id
left join profiles pr on pr.id = c.cree_par
left join (
  select commande_id, count(*) as nb_lignes, sum(quantite_commandee) as quantite_commandee,
         sum(least(quantite_recue, quantite_commandee)) as quantite_recue,
         sum(quantite_commandee * prix_unitaire) as montant
  from commandes_fournisseurs_lignes group by commande_id
) l on l.commande_id = c.id
left join (
  select commande_id, count(*) as nb_receptions from receptions where commande_id is not null group by commande_id
) r on r.commande_id = c.id;

create view v_commandes_fournisseurs_lignes with (security_invoker = true) as
select
  l.*,
  p.reference as produit_reference,
  p.designation as produit_designation,
  p.unite_mesure,
  p.gere_expiration,
  greatest(l.quantite_commandee - l.quantite_recue, 0)::int as quantite_restante,
  (l.quantite_commandee * l.prix_unitaire)::numeric(14, 2) as montant
from commandes_fournisseurs_lignes l
join produits p on p.id = l.produit_id;

-- Transferts enrichis des noms d'entrepots, pour l'ecran Transferts.
create view v_transferts with (security_invoker = true) as
select
  t.*,
  es.nom as entrepot_source_nom,
  ed.nom as entrepot_destination_nom
from transferts t
join entrepots es on es.id = t.entrepot_source_id
join entrepots ed on ed.id = t.entrepot_destination_id;

-- Lignes de transfert enrichies de la reference/designation produit.
create view v_transferts_lignes with (security_invoker = true) as
select
  tl.*,
  p.reference as produit_reference,
  p.designation as produit_designation
from transferts_lignes tl
join produits p on p.id = tl.produit_id;

-- ============================================================
-- 4.5 SUIVI DES STATUTS DE STOCK ET JOURNAL DE STOCK
-- ============================================================
-- Journal des changements de statut (Normal / En alerte / Rupture), alimente
-- par trigger a chaque mouvement et a chaque modification des seuils, et
-- vue v_journal_stock (fiche de stock : stock apres chaque mouvement).

-- ------------------------------------------------------------
-- 1. Regle du statut (identique a la vue v_produits_stock)
-- ------------------------------------------------------------
create function statut_stock(p_stock numeric, p_seuil_reappro integer, p_stock_min integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_stock, 0) <= 0 then 'rupture'
    when p_stock <= coalesce(p_seuil_reappro, p_stock_min) then 'faible'
    else 'normal'
  end
$$;

-- Effet d'un mouvement sur le stock disponible (hors Quarantaine) de son depot.
create function delta_disponible(
  p_type text,
  p_quantite integer,
  p_stock_avant integer,
  p_stock_apres integer,
  p_destination_quarantaine boolean,
  p_origine_quarantaine boolean
)
returns integer
language sql
immutable
as $$
  select case
    when p_type = 'deplacement' then
      (case when coalesce(p_destination_quarantaine, false) then 0 else p_quantite end)
      - (case when coalesce(p_origine_quarantaine, false) then 0 else p_quantite end)
    when coalesce(p_destination_quarantaine, false) then 0
    when p_type in ('entree', 'reintegration') then p_quantite
    when p_type = 'sortie' then -p_quantite
    when p_type = 'transfert' then sign(p_stock_apres - p_stock_avant)::integer * p_quantite
    else p_stock_apres - p_stock_avant
  end
$$;

grant execute on function statut_stock, delta_disponible to authenticated;

-- ------------------------------------------------------------
-- 2. Tables
-- ------------------------------------------------------------
create table historique_statuts_stock (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  ancien_statut text check (ancien_statut in ('normal', 'faible', 'rupture')),
  nouveau_statut text not null check (nouveau_statut in ('normal', 'faible', 'rupture')),
  -- Stock disponible (tous depots) juste apres le changement, et seuil d'alerte applique.
  stock integer not null,
  seuil_alerte integer,
  date_changement timestamptz not null,
  mouvement_id uuid references mouvements_stock(id) on delete set null,
  -- Document responsable (n° de reception, de sortie, de transfert...) ou "Seuils modifies".
  reference text,
  -- 'mouvement' (automatique), 'seuils' (modification des seuils), 'reprise' (reconstitue a la migration).
  origine text not null check (origine in ('mouvement', 'seuils', 'reprise')),
  utilisateur_id uuid references profiles(id) on delete set null,
  enregistre_le timestamptz not null default now()
);

create index historique_statuts_stock_produit_idx on historique_statuts_stock (produit_id, date_changement desc);

-- Statut actuel memorise de chaque produit (pour detecter les changements).
create table produits_statut (
  produit_id uuid primary key references produits(id) on delete cascade,
  statut text not null check (statut in ('normal', 'faible', 'rupture')),
  depuis timestamptz not null
);

-- ------------------------------------------------------------
-- 3. Securite : lecture seule pour l'entreprise, ecriture par les triggers
-- ------------------------------------------------------------
alter table historique_statuts_stock enable row level security;
create policy "lecture historique statuts entreprise" on historique_statuts_stock
  for select using (entreprise_id = current_entreprise_id());

alter table produits_statut enable row level security;
create policy "lecture statut produits entreprise" on produits_statut
  for select using (produit_id in (select id from produits where entreprise_id = current_entreprise_id()));

grant select on historique_statuts_stock, produits_statut to authenticated;

-- ------------------------------------------------------------
-- 4. Detection automatique des changements
-- ------------------------------------------------------------
-- "security definer" : le statut se calcule sur le stock de TOUS les depots
-- de l'entreprise, meme ceux que l'utilisateur ne voit pas.
create function evaluer_statut_produit(
  p_produit_id uuid,
  p_date timestamptz,
  p_mouvement_id uuid,
  p_reference text,
  p_utilisateur_id uuid,
  p_origine text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produit produits%rowtype;
  v_stock integer;
  v_statut text;
  v_ancien text;
begin
  select * into v_produit from produits where id = p_produit_id;
  if not found then
    return;
  end if;

  select coalesce(sum(s.quantite), 0)::int into v_stock
  from stock_produits s
  join emplacements e on e.id = s.emplacement_id
  where s.produit_id = p_produit_id and not e.est_quarantaine;

  v_statut := statut_stock(v_stock, v_produit.seuil_reappro, v_produit.stock_min);

  select statut into v_ancien from produits_statut where produit_id = p_produit_id for update;
  if v_ancien is null then
    -- Produit sans statut memorise : il a ete cree sans stock.
    v_ancien := 'rupture';
    insert into produits_statut (produit_id, statut, depuis) values (p_produit_id, v_ancien, p_date)
    on conflict (produit_id) do nothing;
  end if;

  if v_statut = v_ancien then
    return;
  end if;

  insert into historique_statuts_stock (
    entreprise_id, produit_id, ancien_statut, nouveau_statut, stock, seuil_alerte,
    date_changement, mouvement_id, reference, origine, utilisateur_id
  )
  values (
    v_produit.entreprise_id, p_produit_id, v_ancien, v_statut, v_stock,
    coalesce(v_produit.seuil_reappro, v_produit.stock_min),
    p_date, p_mouvement_id, p_reference, p_origine, p_utilisateur_id
  );
  update produits_statut set statut = v_statut, depuis = p_date where produit_id = p_produit_id;
end;
$$;

revoke execute on function evaluer_statut_produit from public;

create function trg_statut_apres_mouvement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform evaluer_statut_produit(new.produit_id, new.cree_le, new.id, new.reference, new.utilisateur_id, 'mouvement');
  return null;
end;
$$;

-- Differe a la fin de la transaction : le stock est alors entierement a jour
-- (une sortie de plusieurs lignes compte comme un seul changement).
create constraint trigger statut_apres_mouvement
  after insert on mouvements_stock
  deferrable initially deferred
  for each row execute function trg_statut_apres_mouvement();

create function trg_statut_produit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into produits_statut (produit_id, statut, depuis) values (new.id, 'rupture', now())
    on conflict (produit_id) do nothing;
  elsif new.seuil_reappro is distinct from old.seuil_reappro or new.stock_min is distinct from old.stock_min then
    perform evaluer_statut_produit(new.id, now(), null, 'Seuils modifiés', auth.uid(), 'seuils');
  end if;
  return null;
end;
$$;

create trigger statut_produit
  after insert or update of seuil_reappro, stock_min on produits
  for each row execute function trg_statut_produit();

-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Vues du suivi
-- ------------------------------------------------------------
create view v_historique_statuts_stock with (security_invoker = true) as
select h.*, pr.nom_complet as utilisateur_nom, m.type as type_mouvement, m.motif as motif_mouvement
from historique_statuts_stock h
left join profiles pr on pr.id = h.utilisateur_id
left join mouvements_stock m on m.id = h.mouvement_id;

-- Fiche de stock : un mouvement par ligne, avec le stock disponible apres
-- le mouvement, pour le produit (tous depots visibles) et pour son depot.
create view v_journal_stock with (security_invoker = true) as
with mouvements as (
  select
    m.id, m.produit_id, m.entrepot_id, m.type, m.quantite, m.reference, m.motif, m.lot, m.numero_serie,
    m.prix_unitaire, m.cree_le, m.utilisateur_id,
    ed.code as emplacement_code, eo.code as emplacement_origine_code,
    delta_disponible(m.type, m.quantite, m.stock_avant, m.stock_apres, ed.est_quarantaine, eo.est_quarantaine) as delta
  from mouvements_stock m
  left join emplacements ed on ed.id = m.emplacement_id
  left join emplacements eo on eo.id = m.emplacement_origine_id
),
actuel_depot as (
  select s.produit_id, s.entrepot_id, sum(case when e.est_quarantaine then 0 else s.quantite end)::int as stock
  from stock_produits s
  join emplacements e on e.id = s.emplacement_id
  group by s.produit_id, s.entrepot_id
),
actuel_produit as (
  select produit_id, sum(stock)::int as stock from actuel_depot group by produit_id
)
select
  mv.id, mv.produit_id, mv.entrepot_id, en.nom as entrepot_nom, mv.type, mv.quantite, mv.reference, mv.motif,
  mv.lot, mv.numero_serie, mv.prix_unitaire, mv.cree_le, pr.nom_complet as utilisateur_nom,
  mv.emplacement_code, mv.emplacement_origine_code,
  mv.delta,
  greatest(mv.delta, 0) as entree,
  greatest(-mv.delta, 0) as sortie,
  (coalesce(ap.stock, 0) - sum(mv.delta) over (partition by mv.produit_id)
    + sum(mv.delta) over (partition by mv.produit_id order by mv.cree_le, mv.id rows unbounded preceding))::int as stock_apres,
  (coalesce(ad.stock, 0) - sum(mv.delta) over (partition by mv.produit_id, mv.entrepot_id)
    + sum(mv.delta) over (partition by mv.produit_id, mv.entrepot_id order by mv.cree_le, mv.id rows unbounded preceding))::int as stock_apres_depot
from mouvements mv
join entrepots en on en.id = mv.entrepot_id
left join profiles pr on pr.id = mv.utilisateur_id
left join actuel_produit ap on ap.produit_id = mv.produit_id
left join actuel_depot ad on ad.produit_id = mv.produit_id and ad.entrepot_id = mv.entrepot_id;

grant select on v_historique_statuts_stock, v_journal_stock to authenticated;

-- ============================================================
-- 5. COMPTE DE DEMARRAGE
-- ============================================================
-- Cree ton entreprise, puis un utilisateur (Authentication > Users > Add
-- user dans le tableau de bord Supabase), note son UID, et lie-le a
-- l'entreprise avec le role Administrateur :
--
-- insert into entreprises (nom) values ('Mon Entreprise') returning id;
--
-- insert into profiles (id, entreprise_id, nom_complet, role)
-- values ('<uid-utilisateur>', '<id-entreprise>', 'Jean Didier', 'administrateur');

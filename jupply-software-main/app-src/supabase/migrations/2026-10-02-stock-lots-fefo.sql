-- Migration du 02/10/2026 : suivi du stock par lot (FEFO / FIFO).
--
-- - Nouvelle table stock_lots : ce qu'il reste de chaque lot, par emplacement.
-- - Une synchronisation automatique (trigger) garde stock_lots egal a
--   stock_produits quelle que soit l'operation.
-- - Reception : cree les lots. Sortie : consomme le lot choisi et le note
--   sur le bon. Reintegration : remet la quantite dans le lot d'origine.
-- - Bons de sortie numerotes BS-<annee>-<sequence> (au lieu de SOR-).
-- - Lot (ou N° de serie) obligatoire des qu'une date d'expiration est saisie.
--
-- A executer dans l'editeur SQL de Supabase (ou via scripts/run-sql.mjs).
-- Peut etre re-executee sans risque. Tout est dans une seule transaction :
-- si une instruction echoue, rien n'est applique.
-- schema.sql contient deja la nouvelle definition.

begin;

-- ------------------------------------------------------------
-- 0. Contenu de la migration precedente (2026-10-02-reception-fournisseurs),
--    repris ici pour que ce fichier se suffise a lui-meme. Sans effet si elle
--    a deja ete appliquee.
-- ------------------------------------------------------------
alter table receptions add column if not exists notes text;
alter table receptions_lignes
  add column if not exists quantite_non_conforme integer not null default 0,
  add column if not exists motif_non_conformite text,
  add column if not exists constat_non_conformite text;
alter table fournisseurs
  add column if not exists telephone text,
  add column if not exists email text,
  add column if not exists adresse text,
  add column if not exists ville text,
  add column if not exists pays text;
drop function if exists creer_reception(uuid, uuid, text, jsonb);

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------

-- Stock restant par lot. La somme des lots d'un (produit, entrepot,
-- emplacement) est toujours egale a stock_produits.quantite.
create table if not exists stock_lots (
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

create index if not exists stock_lots_cle_idx on stock_lots (produit_id, entrepot_id, emplacement_id);

-- Tampon interne : lots retires d'un emplacement pendant une transaction,
-- pour les reposer a l'identique si le meme produit est remis ailleurs dans
-- la meme transaction (deplacement interne). Volontairement sans cle
-- etrangere : il est ecrit depuis un trigger, y compris pendant une
-- suppression en cascade.
create table if not exists lots_en_mouvement (
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

-- Le lot sorti est note sur la ligne du bon (affichage + reintegration).
alter table bons_sortie_lignes
  add column if not exists lot text,
  add column if not exists numero_serie text,
  add column if not exists date_expiration date,
  add column if not exists date_entree_lot timestamptz;

-- ------------------------------------------------------------
-- 2. Securite (memes regles que stock_produits)
-- ------------------------------------------------------------
alter table stock_lots enable row level security;
drop policy if exists "acces lots visibles" on stock_lots;
create policy "acces lots visibles" on stock_lots
  for all
  using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

alter table lots_en_mouvement enable row level security;
drop policy if exists "acces lots en mouvement visibles" on lots_en_mouvement;
create policy "acces lots en mouvement visibles" on lots_en_mouvement
  for all
  using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

grant select, insert, update, delete on stock_lots, lots_en_mouvement to authenticated;

-- ------------------------------------------------------------
-- 3. Reprise de l'existant : le stock actuel devient un lot "sans lot" par
--    emplacement, date de sa premiere entree connue.
-- ------------------------------------------------------------
insert into stock_lots (produit_id, entrepot_id, emplacement_id, date_entree, quantite)
select
  s.produit_id,
  s.entrepot_id,
  s.emplacement_id,
  coalesce(
    (select min(m.cree_le) from mouvements_stock m
      where m.produit_id = s.produit_id and m.entrepot_id = s.entrepot_id
        and m.emplacement_id = s.emplacement_id and m.type = 'entree'),
    now()
  ),
  s.quantite - coalesce(l.total, 0)
from stock_produits s
left join (
  select produit_id, entrepot_id, emplacement_id, sum(quantite)::int as total
  from stock_lots
  group by produit_id, entrepot_id, emplacement_id
) l on l.produit_id = s.produit_id and l.entrepot_id = s.entrepot_id and l.emplacement_id = s.emplacement_id
where s.quantite - coalesce(l.total, 0) > 0;

-- ------------------------------------------------------------
-- 4. Fonctions internes
-- ------------------------------------------------------------

-- Ajoute une quantite a un lot (le cree s'il n'existe pas encore a cet
-- emplacement avec exactement les memes caracteristiques).
create or replace function ajouter_lot(
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
create or replace function synchroniser_lots()
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

drop trigger if exists stock_produits_synchroniser_lots on stock_produits;
create trigger stock_produits_synchroniser_lots
  after insert or update of quantite or delete on stock_produits
  for each row execute function synchroniser_lots();

-- ------------------------------------------------------------
-- 5. Reception : lot obligatoire avec une date d'expiration
-- ------------------------------------------------------------
create or replace function creer_reception(
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
  v_ligne jsonb;
  v_gere_expiration boolean;
  v_reference text;
  v_quantite_recue integer;
  v_quantite_nc integer;
  v_motif_nc text;
begin
  select entreprise_id into v_entreprise_id from entrepots where id = p_entrepot_id;
  if v_entreprise_id is null then
    raise exception 'Entrepot introuvable.';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une reception doit contenir au moins une ligne.';
  end if;

  v_date := coalesce(p_date_mouvement, now());
  v_numero := 'REC-' || to_char(v_date, 'YYYY') || '-' || lpad(nextval('receptions_numero_seq')::text, 5, '0');

  insert into receptions (entreprise_id, numero, entrepot_id, fournisseur_id, numero_po, statut, cree_par, notes, cree_le)
  values (
    v_entreprise_id, v_numero, p_entrepot_id, p_fournisseur_id, nullif(p_numero_po, ''), 'en_attente', auth.uid(),
    nullif(p_notes, ''), v_date
  )
  returning id into v_reception_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    select gere_expiration, reference into v_gere_expiration, v_reference
      from produits where id = (v_ligne->>'produit_id')::uuid;

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
      v_reception_id,
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

  return v_reception_id;
end;
$$;

grant execute on function creer_reception to authenticated;

-- ------------------------------------------------------------
-- 6. Validation d'une reception : cree les lots
-- ------------------------------------------------------------
create or replace function valider_reception(p_reception_id uuid)
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
begin
  select entreprise_id, entrepot_id, numero, cree_le, fournisseur_id, numero_po
    into v_entreprise_id, v_entrepot_id, v_numero, v_date_entree, v_fournisseur_id, v_numero_po
    from receptions where id = p_reception_id;

  if v_entrepot_id is null then
    raise exception 'Reception introuvable.';
  end if;

  select id into v_quarantaine_id from emplacements where entrepot_id = v_entrepot_id and est_quarantaine;

  for v_ligne in select * from receptions_lignes where reception_id = p_reception_id
  loop
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
        where produit_id = v_ligne.produit_id and entrepot_id = v_entrepot_id and emplacement_id = v_ligne.emplacement_id;
      v_stock_avant := coalesce(v_stock_avant, 0);
      v_stock_apres := v_stock_avant + v_qte_normale;

      -- Le lot d'abord, le stock ensuite (voir synchroniser_lots).
      perform ajouter_lot(
        v_ligne.produit_id, v_entrepot_id, v_ligne.emplacement_id, v_ligne.lot, v_ligne.numero_serie,
        v_ligne.date_expiration, v_date_entree, v_ligne.prix_unitaire, v_qte_normale
      );

      insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
      values (v_ligne.produit_id, v_entrepot_id, v_ligne.emplacement_id, v_qte_normale)
      on conflict (produit_id, entrepot_id, emplacement_id)
      do update set quantite = stock_produits.quantite + excluded.quantite;

      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite,
        stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, prix_unitaire
      )
      values (
        v_entreprise_id, v_ligne.produit_id, v_entrepot_id, v_ligne.emplacement_id, 'entree', v_qte_normale,
        v_stock_avant, v_stock_apres, auth.uid(), v_numero, 'Réception validée',
        v_ligne.lot, v_ligne.numero_serie, v_ligne.prix_unitaire
      );
    end if;

    if v_qte_quarantaine > 0 then
      v_numero_nc := 'NC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('non_conformites_numero_seq')::text, 5, '0');

      select quantite into v_stock_avant from stock_produits
        where produit_id = v_ligne.produit_id and entrepot_id = v_entrepot_id and emplacement_id = v_quarantaine_id;
      v_stock_avant := coalesce(v_stock_avant, 0);
      v_stock_apres := v_stock_avant + v_qte_quarantaine;

      perform ajouter_lot(
        v_ligne.produit_id, v_entrepot_id, v_quarantaine_id, v_ligne.lot, v_ligne.numero_serie,
        v_ligne.date_expiration, v_date_entree, v_ligne.prix_unitaire, v_qte_quarantaine
      );

      insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
      values (v_ligne.produit_id, v_entrepot_id, v_quarantaine_id, v_qte_quarantaine)
      on conflict (produit_id, entrepot_id, emplacement_id)
      do update set quantite = stock_produits.quantite + excluded.quantite;

      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite,
        stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, prix_unitaire
      )
      values (
        v_entreprise_id, v_ligne.produit_id, v_entrepot_id, v_quarantaine_id, 'entree', v_qte_quarantaine,
        v_stock_avant, v_stock_apres, auth.uid(), v_numero, 'Non-conformité à réception - Quarantaine (' || v_numero_nc || ')',
        v_ligne.lot, v_ligne.numero_serie, v_ligne.prix_unitaire
      );

      insert into non_conformites (
        entreprise_id, numero, entrepot_id, emplacement_id, produit_id, lot, numero_serie, date_expiration,
        date_entree_lot, prix_unitaire, origine, reception_id, fournisseur_id, numero_po, motif, constat,
        quantite_initiale, quantite_restante, declare_par
      )
      values (
        v_entreprise_id, v_numero_nc, v_entrepot_id, v_quarantaine_id, v_ligne.produit_id, v_ligne.lot,
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

-- ------------------------------------------------------------
-- 7. Sortie : consomme le lot choisi, numerotation BS-
-- ------------------------------------------------------------
-- p_lignes : tableau JSON, un objet par ligne avec produit_id,
-- emplacement_id, quantite et (optionnel) stock_lot_id. Sans stock_lot_id,
-- les lots sont consommes automatiquement dans l'ordre FEFO / FIFO.
-- Un lot perime ne peut sortir qu'avec une note (p_motif).
alter table bons_sortie add column if not exists recu_par text;
drop function if exists creer_sortie(uuid, text, jsonb, timestamptz);
drop function if exists creer_sortie(uuid, text, jsonb, timestamptz, text);

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
begin
  select entreprise_id into v_entreprise_id from entrepots where id = p_entrepot_id;
  if v_entreprise_id is null then
    raise exception 'Entrepot introuvable.';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une sortie doit contenir au moins une ligne.';
  end if;

  v_date := coalesce(p_date_mouvement, now());
  v_numero := 'BS-' || to_char(v_date, 'YYYY') || '-' || lpad(nextval('bons_sortie_numero_seq')::text, 5, '0');

  insert into bons_sortie (entreprise_id, numero, entrepot_id, demande_par, statut, motif, recu_par, cree_le)
  values (
    v_entreprise_id, v_numero, p_entrepot_id, auth.uid(), 'confirmee', nullif(p_motif, ''), nullif(btrim(p_recu_par), ''), v_date
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

    select quantite into v_stock_avant from stock_produits
      where produit_id = v_produit_id and entrepot_id = p_entrepot_id and emplacement_id = v_emplacement_id
      for update;

    if v_stock_avant is null or v_stock_avant < v_quantite then
      raise exception 'Stock insuffisant pour ce produit a cet emplacement.';
    end if;

    -- Le lot d'abord, le stock ensuite (voir synchroniser_lots).
    if v_stock_lot_id is not null then
      select * into v_lot from stock_lots
        where id = v_stock_lot_id and produit_id = v_produit_id
          and entrepot_id = p_entrepot_id and emplacement_id = v_emplacement_id
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
        where produit_id = v_produit_id and entrepot_id = p_entrepot_id and emplacement_id = v_emplacement_id;
    else
      update stock_produits set quantite = v_stock_apres
        where produit_id = v_produit_id and entrepot_id = p_entrepot_id and emplacement_id = v_emplacement_id;
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
      v_entreprise_id, v_produit_id, p_entrepot_id, v_emplacement_id,
      'sortie', v_quantite, v_stock_avant, v_stock_apres, auth.uid(), v_numero, p_motif,
      v_lot.lot, v_lot.numero_serie, v_date
    );
  end loop;

  return v_bon_id;
end;
$$;

grant execute on function creer_sortie to authenticated;

-- ------------------------------------------------------------
-- 8. Reintegration : remet la quantite dans le lot d'origine
-- ------------------------------------------------------------
create or replace function creer_reintegration(
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
    select bsl.produit_id, bs.entrepot_id, bsl.quantite, bsl.lot, bsl.numero_serie, bsl.date_expiration, bsl.date_entree_lot
      into v_ligne_produit_id, v_ligne_entrepot_id, v_ligne_quantite_sortie,
           v_ligne_lot, v_ligne_numero_serie, v_ligne_date_expiration, v_ligne_date_entree
      from bons_sortie_lignes bsl
      join bons_sortie bs on bs.id = bsl.bon_sortie_id
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

-- Recharge le cache de l'API Supabase (nouvelles tables et colonnes).
notify pgrst, 'reload schema';

commit;

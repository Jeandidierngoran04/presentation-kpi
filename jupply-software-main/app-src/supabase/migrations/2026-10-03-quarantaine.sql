-- Migration du 03/10/2026 : gestion de la quarantaine par dossiers de
-- non-conformite (NC).
--
-- - Rien ne part en quarantaine sans decision de l'operateur : a la
--   reception, il indique la quantite non conforme d'une ligne, avec le
--   motif et le constat. Le surplus (recu > commande) n'est plus mis en
--   quarantaine automatiquement.
-- - Chaque mise en quarantaine ouvre un dossier NC-<annee>-<sequence>
--   (a la reception, ou declaration manuelle depuis le stock).
-- - Traitement d'un dossier : liberation en stock, retour fournisseur, mise
--   au rebut, reparation ; le stock et les lots sont mis a jour.
-- - Le stock deja en quarantaine est repris en dossiers "a qualifier".
--
-- A executer dans l'editeur SQL de Supabase, APRES les migrations du
-- 02/10 et du 03/10 (historique). Peut etre re-executee sans risque.
-- Tout est dans une seule transaction. schema.sql contient deja la
-- nouvelle definition.

begin;

-- ------------------------------------------------------------
-- 1. Non-conformite saisie sur la ligne de reception
-- ------------------------------------------------------------
alter table receptions_lignes
  add column if not exists quantite_non_conforme integer not null default 0,
  add column if not exists motif_non_conformite text,
  add column if not exists constat_non_conformite text;

-- ------------------------------------------------------------
-- 2. Dossiers de non-conformite et leurs traitements
-- ------------------------------------------------------------
create sequence if not exists non_conformites_numero_seq;

create table if not exists non_conformites (
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

create index if not exists non_conformites_entrepot_statut_idx on non_conformites (entrepot_id, statut);

create table if not exists non_conformites_traitements (
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

create index if not exists non_conformites_traitements_nc_idx on non_conformites_traitements (non_conformite_id);

-- ------------------------------------------------------------
-- 3. Securite
-- ------------------------------------------------------------
alter table non_conformites enable row level security;
drop policy if exists "acces non conformites visibles" on non_conformites;
create policy "acces non conformites visibles" on non_conformites
  for all
  using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

alter table non_conformites_traitements enable row level security;
drop policy if exists "acces traitements non conformites visibles" on non_conformites_traitements;
create policy "acces traitements non conformites visibles" on non_conformites_traitements
  for all
  using (non_conformite_id in (select id from non_conformites where entrepot_id in (select entrepots_visibles())))
  with check (non_conformite_id in (select id from non_conformites where entrepot_id in (select entrepots_visibles())));

grant select, insert, update, delete on non_conformites, non_conformites_traitements to authenticated;
grant usage, select on sequence non_conformites_numero_seq to authenticated;

-- ------------------------------------------------------------
-- 4. Fonctions internes
-- ------------------------------------------------------------

-- Ajoute (ou retire, delta negatif) une quantite a un emplacement et
-- renvoie le stock avant / apres. Refuse un stock negatif.
create or replace function ajuster_stock_emplacement(
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
create or replace function retirer_lot(
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

-- ------------------------------------------------------------
-- 5. Reception : quantite non conforme saisie par l'operateur
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
-- 6. Validation d'une reception : seule la quantite declaree non conforme
--    part en quarantaine, avec ouverture d'un dossier NC
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
-- 7. Declaration manuelle depuis le stock (dommage constate en rayon...)
-- ------------------------------------------------------------
create or replace function declarer_non_conformite(
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

-- ------------------------------------------------------------
-- 8. Traitement d'un dossier
-- ------------------------------------------------------------
-- p_decisions : tableau JSON, un objet par decision :
--   decision ('liberation' | 'retour_fournisseur' | 'rebut' | 'reparation'),
--   quantite, source ('a_traiter' par defaut | 'reparation'),
--   emplacement_destination_id (liberation), reference_document.
create or replace function traiter_non_conformite(
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

-- ------------------------------------------------------------
-- 9. Reprise de l'existant : le stock deja en quarantaine devient des
--    dossiers "a qualifier" (relies a la reception d'origine si possible)
-- ------------------------------------------------------------
insert into non_conformites (
  entreprise_id, numero, entrepot_id, emplacement_id, produit_id, lot, numero_serie, date_expiration,
  date_entree_lot, prix_unitaire, origine, reception_id, fournisseur_id, numero_po, motif, constat,
  quantite_initiale, quantite_restante, declare_par, cree_le
)
select
  e.entreprise_id,
  'NC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('non_conformites_numero_seq')::text, 5, '0'),
  l.entrepot_id,
  l.emplacement_id,
  l.produit_id,
  l.lot,
  l.numero_serie,
  l.date_expiration,
  l.date_entree,
  coalesce(l.prix_unitaire, p.prix_moyen_pondere),
  'reprise',
  r.id,
  r.fournisseur_id,
  r.numero_po,
  case when m.motif ilike 'Surplus%' then 'surplus' else 'autre' end,
  'Stock déjà en quarantaine avant la mise en place du suivi : à qualifier.',
  l.quantite,
  l.quantite,
  r.cree_par,
  coalesce(m.cree_le, l.date_entree)
from stock_lots l
join emplacements em on em.id = l.emplacement_id and em.est_quarantaine
join entrepots e on e.id = l.entrepot_id
join produits p on p.id = l.produit_id
left join lateral (
  select ms.reference, ms.motif, ms.cree_le
  from mouvements_stock ms
  where ms.produit_id = l.produit_id and ms.emplacement_id = l.emplacement_id and ms.type = 'entree'
  order by ms.cree_le desc
  limit 1
) m on true
left join receptions r on r.entreprise_id = e.entreprise_id and r.numero = m.reference
where not exists (
  select 1 from non_conformites nc
  where nc.emplacement_id = l.emplacement_id and nc.produit_id = l.produit_id and nc.statut <> 'cloturee'
    and nc.lot is not distinct from l.lot
    and nc.numero_serie is not distinct from l.numero_serie
    and nc.date_expiration is not distinct from l.date_expiration
);

-- ------------------------------------------------------------
-- 10. Vues
-- ------------------------------------------------------------
drop view if exists v_quarantaine_traitements;
drop view if exists v_quarantaine;

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

grant select on v_quarantaine, v_quarantaine_traitements to authenticated;

notify pgrst, 'reload schema';

commit;

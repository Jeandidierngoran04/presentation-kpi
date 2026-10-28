-- Migration du 27/10/2026 : suivi des statuts de stock et journal de stock.
--
-- - Journal des changements de statut d'un produit (Normal / En alerte /
--   Rupture) : date, ancien et nouveau statut, stock, seuil, document qui a
--   provoque le changement. Alimente automatiquement a chaque mouvement de
--   stock et a chaque modification des seuils du produit.
-- - Reprise du passe : reconstitue une fois depuis les mouvements deja
--   enregistres, avec les seuils ACTUELS des produits (dates anciennes
--   approximatives si un seuil a change entre-temps).
-- - Vue v_journal_stock : chaque mouvement avec sa quantite entree / sortie
--   du stock disponible et le stock apres le mouvement (fiche de stock).
--
-- Le "stock disponible" exclut la Quarantaine, comme partout ailleurs : une
-- mise en quarantaine compte comme une sortie du disponible, une liberation
-- comme une entree.
--
-- A executer dans l'editeur SQL de Supabase, APRES
-- 2026-10-27-commandes-fournisseurs.sql. Peut etre re-executee sans risque.
-- schema.sql contient deja la nouvelle definition.

begin;

-- ------------------------------------------------------------
-- 1. Regle du statut (identique a la vue v_produits_stock)
-- ------------------------------------------------------------
create or replace function statut_stock(p_stock numeric, p_seuil_reappro integer, p_stock_min integer)
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
create or replace function delta_disponible(
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
create table if not exists historique_statuts_stock (
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

create index if not exists historique_statuts_stock_produit_idx on historique_statuts_stock (produit_id, date_changement desc);

-- Statut actuel memorise de chaque produit (pour detecter les changements).
create table if not exists produits_statut (
  produit_id uuid primary key references produits(id) on delete cascade,
  statut text not null check (statut in ('normal', 'faible', 'rupture')),
  depuis timestamptz not null
);

-- ------------------------------------------------------------
-- 3. Securite : lecture seule pour l'entreprise, ecriture par les triggers
-- ------------------------------------------------------------
alter table historique_statuts_stock enable row level security;
drop policy if exists "lecture historique statuts entreprise" on historique_statuts_stock;
create policy "lecture historique statuts entreprise" on historique_statuts_stock
  for select using (entreprise_id = current_entreprise_id());

alter table produits_statut enable row level security;
drop policy if exists "lecture statut produits entreprise" on produits_statut;
create policy "lecture statut produits entreprise" on produits_statut
  for select using (produit_id in (select id from produits where entreprise_id = current_entreprise_id()));

grant select on historique_statuts_stock, produits_statut to authenticated;

-- ------------------------------------------------------------
-- 4. Detection automatique des changements
-- ------------------------------------------------------------
-- "security definer" : le statut se calcule sur le stock de TOUS les depots
-- de l'entreprise, meme ceux que l'utilisateur ne voit pas.
create or replace function evaluer_statut_produit(
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

create or replace function trg_statut_apres_mouvement()
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
drop trigger if exists statut_apres_mouvement on mouvements_stock;
create constraint trigger statut_apres_mouvement
  after insert on mouvements_stock
  deferrable initially deferred
  for each row execute function trg_statut_apres_mouvement();

create or replace function trg_statut_produit()
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

drop trigger if exists statut_produit on produits;
create trigger statut_produit
  after insert or update of seuil_reappro, stock_min on produits
  for each row execute function trg_statut_produit();

-- ------------------------------------------------------------
-- 5. Reprise du passe (une seule fois)
-- ------------------------------------------------------------
-- Stock disponible actuel moins la somme des mouvements = stock avant le
-- premier mouvement enregistre. On rejoue ensuite les mouvements un par un.
do $$
begin
  if exists (select 1 from historique_statuts_stock) then
    return;
  end if;

  with mouvements as (
    select
      m.id, m.entreprise_id, m.produit_id, m.cree_le, m.reference, m.utilisateur_id,
      delta_disponible(m.type, m.quantite, m.stock_avant, m.stock_apres, ed.est_quarantaine, eo.est_quarantaine) as delta
    from mouvements_stock m
    left join emplacements ed on ed.id = m.emplacement_id
    left join emplacements eo on eo.id = m.emplacement_origine_id
  ),
  actuel as (
    select s.produit_id, coalesce(sum(case when e.est_quarantaine then 0 else s.quantite end), 0)::int as stock
    from stock_produits s
    join emplacements e on e.id = s.emplacement_id
    group by s.produit_id
  ),
  cumul as (
    select
      mv.*,
      coalesce(a.stock, 0) - sum(mv.delta) over (partition by mv.produit_id)
        + sum(mv.delta) over (partition by mv.produit_id order by mv.cree_le, mv.id rows unbounded preceding) as stock_apres,
      coalesce(a.stock, 0) - sum(mv.delta) over (partition by mv.produit_id) as stock_initial
    from mouvements mv
    left join actuel a on a.produit_id = mv.produit_id
  ),
  statuts as (
    select
      c.*,
      p.seuil_reappro, p.stock_min,
      statut_stock(c.stock_apres, p.seuil_reappro, p.stock_min) as statut,
      lag(statut_stock(c.stock_apres, p.seuil_reappro, p.stock_min),
          1, statut_stock(c.stock_initial, p.seuil_reappro, p.stock_min))
        over (partition by c.produit_id order by c.cree_le, c.id) as statut_precedent
    from cumul c
    join produits p on p.id = c.produit_id
  )
  insert into historique_statuts_stock (
    entreprise_id, produit_id, ancien_statut, nouveau_statut, stock, seuil_alerte,
    date_changement, mouvement_id, reference, origine, utilisateur_id
  )
  select
    entreprise_id, produit_id, statut_precedent, statut, stock_apres::int, coalesce(seuil_reappro, stock_min),
    cree_le, id, reference, 'reprise', utilisateur_id
  from statuts
  where statut <> statut_precedent;
end;
$$;

-- Statut actuel de chaque produit, depuis son dernier changement connu.
insert into produits_statut (produit_id, statut, depuis)
select
  p.id,
  statut_stock(coalesce(a.stock, 0), p.seuil_reappro, p.stock_min),
  coalesce((select max(h.date_changement) from historique_statuts_stock h where h.produit_id = p.id), now())
from produits p
left join (
  select s.produit_id, sum(case when e.est_quarantaine then 0 else s.quantite end)::int as stock
  from stock_produits s
  join emplacements e on e.id = s.emplacement_id
  group by s.produit_id
) a on a.produit_id = p.id
on conflict (produit_id) do nothing;

-- ------------------------------------------------------------
-- 6. Vues
-- ------------------------------------------------------------
drop view if exists v_historique_statuts_stock;
create view v_historique_statuts_stock with (security_invoker = true) as
select h.*, pr.nom_complet as utilisateur_nom, m.type as type_mouvement, m.motif as motif_mouvement
from historique_statuts_stock h
left join profiles pr on pr.id = h.utilisateur_id
left join mouvements_stock m on m.id = h.mouvement_id;

-- Fiche de stock : un mouvement par ligne, avec le stock disponible apres
-- le mouvement, pour le produit (tous depots visibles) et pour son depot.
drop view if exists v_journal_stock;
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

notify pgrst, 'reload schema';

commit;

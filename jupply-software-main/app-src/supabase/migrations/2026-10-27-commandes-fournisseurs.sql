-- Migration du 27/10/2026 : commandes fournisseurs (PO).
--
-- - Bon de commande PO-<annee>-<sequence> : fournisseur, depot de livraison,
--   lignes (quantite commandee, prix), statuts Fait -> Envoye -> En transit
--   -> En cours de reception -> Completee ; cloture manuelle avec motif.
-- - Reception d'une commande : creee et validee en une fois (stock, lots,
--   PMP, quarantaine par la validation existante), rattachee a la commande.
--   Plusieurs receptions tant que le recu est inferieur au commande ; des
--   que recu = commande, la commande passe Completee (plus de reception).
-- - La colonne "En commande" (Produits, Alertes stock) inclut les reliquats
--   des commandes en cours.
--
-- A executer dans l'editeur SQL de Supabase, APRES 2026-10-03-quarantaine.sql.
-- Peut etre re-executee sans risque. Tout est dans une seule transaction.
-- schema.sql contient deja la nouvelle definition.

begin;

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create sequence if not exists commandes_fournisseurs_numero_seq;

create table if not exists commandes_fournisseurs (
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

create index if not exists commandes_fournisseurs_entrepot_statut_idx on commandes_fournisseurs (entrepot_id, statut);

create table if not exists commandes_fournisseurs_lignes (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes_fournisseurs(id) on delete cascade,
  produit_id uuid not null references produits(id),
  quantite_commandee integer not null check (quantite_commandee > 0),
  prix_unitaire numeric(14, 2) not null default 0,
  -- Cumul de tout ce qui a ete livre (y compris la part mise en quarantaine).
  quantite_recue integer not null default 0 check (quantite_recue >= 0)
);

create index if not exists commandes_fournisseurs_lignes_commande_idx on commandes_fournisseurs_lignes (commande_id);

-- Une reception peut etre rattachee a une commande (et chaque ligne a sa ligne de commande).
alter table receptions add column if not exists commande_id uuid references commandes_fournisseurs(id) on delete set null;
alter table receptions_lignes add column if not exists commande_ligne_id uuid references commandes_fournisseurs_lignes(id) on delete set null;

-- ------------------------------------------------------------
-- 2. Securite
-- ------------------------------------------------------------
alter table commandes_fournisseurs enable row level security;
drop policy if exists "acces commandes fournisseurs visibles" on commandes_fournisseurs;
create policy "acces commandes fournisseurs visibles" on commandes_fournisseurs
  for all
  using (entrepot_id in (select entrepots_visibles()))
  with check (entrepot_id in (select entrepots_visibles()));

alter table commandes_fournisseurs_lignes enable row level security;
drop policy if exists "acces lignes commandes fournisseurs visibles" on commandes_fournisseurs_lignes;
create policy "acces lignes commandes fournisseurs visibles" on commandes_fournisseurs_lignes
  for all
  using (commande_id in (select id from commandes_fournisseurs where entrepot_id in (select entrepots_visibles())))
  with check (commande_id in (select id from commandes_fournisseurs where entrepot_id in (select entrepots_visibles())));

grant select, insert, update, delete on commandes_fournisseurs, commandes_fournisseurs_lignes to authenticated;
grant usage, select on sequence commandes_fournisseurs_numero_seq to authenticated;

-- ------------------------------------------------------------
-- 3. Creation d'une commande (statut "fait")
-- ------------------------------------------------------------
-- p_lignes : tableau JSON, un objet par ligne : produit_id, quantite_commandee, prix_unitaire.
create or replace function creer_commande_fournisseur(
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

-- ------------------------------------------------------------
-- 4. Changements de statut manuels : Envoye, En transit
-- ------------------------------------------------------------
create or replace function changer_statut_commande(p_commande_id uuid, p_statut text)
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

-- ------------------------------------------------------------
-- 5. Cloture manuelle (motif obligatoire)
-- ------------------------------------------------------------
create or replace function cloturer_commande(p_commande_id uuid, p_motif text)
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

-- ------------------------------------------------------------
-- 6. Reception d'une commande (creee et validee en une fois)
-- ------------------------------------------------------------
-- p_lignes : tableau JSON, un objet par ligne recue : commande_ligne_id,
-- emplacement_id, quantite_recue, lot, numero_serie, date_expiration,
-- quantite_non_conforme, motif_non_conformite, constat_non_conformite.
create or replace function receptionner_commande(
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

-- ------------------------------------------------------------
-- 7. Vues
-- ------------------------------------------------------------
drop view if exists v_commandes_fournisseurs_lignes;
drop view if exists v_commandes_fournisseurs;

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

-- "En commande" : receptions manuelles en attente + reliquats des commandes en cours.
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

grant select on v_commandes_fournisseurs, v_commandes_fournisseurs_lignes, v_produits_commandes to authenticated;

notify pgrst, 'reload schema';

commit;

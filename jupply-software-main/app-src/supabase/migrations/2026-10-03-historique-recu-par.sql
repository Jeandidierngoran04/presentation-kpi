-- Migration du 03/10/2026 : "Reçu par" sur les bons de sortie et vues du
-- module Historique.
--
-- - bons_sortie.recu_par : nom de la personne qui reçoit la sortie
--   (imprime dans le cadre "Reçu par / Given to" du bon).
-- - creer_sortie accepte p_recu_par (l'ancienne version est remplacee).
-- - Vues v_historique_* : listes et details des sorties, entrees,
--   reintegrations, transferts et de tous les mouvements.
--
-- A executer dans l'editeur SQL de Supabase, APRES 2026-10-02-stock-lots-fefo.sql.
-- Peut etre re-executee sans risque. Tout est dans une seule transaction.
-- schema.sql contient deja la nouvelle definition.

begin;

alter table bons_sortie add column if not exists recu_par text;

-- Une seule version de creer_sortie (sinon l'API ne saurait laquelle appeler).
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

drop view if exists v_historique_sorties;
drop view if exists v_historique_sorties_lignes;
drop view if exists v_historique_entrees;
drop view if exists v_historique_entrees_lignes;
drop view if exists v_historique_reintegrations;
drop view if exists v_historique_reintegrations_lignes;
drop view if exists v_historique_transferts;
drop view if exists v_historique_transferts_lignes;
drop view if exists v_historique_mouvements;

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

grant select on v_historique_sorties, v_historique_sorties_lignes, v_historique_entrees, v_historique_entrees_lignes, v_historique_reintegrations, v_historique_reintegrations_lignes, v_historique_transferts, v_historique_transferts_lignes, v_historique_mouvements to authenticated;

notify pgrst, 'reload schema';

commit;

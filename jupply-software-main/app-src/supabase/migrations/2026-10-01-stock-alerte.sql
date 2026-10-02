-- Migration du 01/10/2026 : le stock d'alerte devient le seuil de
-- reapprovisionnement (point de commande), et non plus le stock minimum.
-- A defaut de seuil renseigne sur le produit, on retombe sur le stock minimum.
--
-- A executer une seule fois dans l'editeur SQL de Supabase (ou via
-- scripts/run-sql.mjs). Ne touche a aucune donnee : seules deux vues sont
-- recreees. schema.sql contient deja la nouvelle definition.

begin;

drop view if exists v_produits_stock;
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

drop view if exists v_stock_par_entrepot;
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

-- Les vues recreees doivent rester lisibles par l'application.
grant select on v_produits_stock, v_stock_par_entrepot to anon, authenticated;

commit;

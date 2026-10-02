-- Migration du 02/10/2026 : recree la vue de l'historique des mouvements.
--
-- Une vue "select m.*" fige la liste des colonnes au moment de sa creation :
-- si des colonnes ont ete ajoutees a mouvements_stock ensuite (lot,
-- N° de serie, prix...), la vue ne les renvoie pas et l'ecran Produits
-- affiche "—" dans "Derniers mouvements". La recreer remet toutes les
-- colonnes. Aucune donnee n'est modifiee.
--
-- A executer dans l'editeur SQL de Supabase. Peut etre re-executee sans risque.

begin;

drop view if exists v_mouvements_recents;
create view v_mouvements_recents with (security_invoker = true) as
select
  m.*,
  p.designation as produit_designation,
  pr.nom_complet as utilisateur_nom
from mouvements_stock m
join produits p on p.id = m.produit_id
join profiles pr on pr.id = m.utilisateur_id;

grant select on v_mouvements_recents to anon, authenticated;

notify pgrst, 'reload schema';

commit;

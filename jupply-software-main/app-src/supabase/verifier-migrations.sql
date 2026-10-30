-- Vérification : quelles migrations sont réellement appliquées dans la base ?
-- Lecture seule (ne modifie rien). À coller dans Supabase > SQL Editor > Run.
-- Chaque ligne indique "true" si la migration est appliquée, "false" sinon.
-- Les migrations "false" sont à exécuter, dans l'ordre des numéros.

select '01. 2026-10-01-stock-alerte' as migration,
       pg_get_viewdef('public.v_produits_stock'::regclass) ilike '%seuil_reappro%' as appliquee
union all
select '02. 2026-10-02-reception-fournisseurs',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'fournisseurs' and column_name = 'telephone')
union all
select '03. 2026-10-02-stock-lots-fefo', to_regclass('public.stock_lots') is not null
union all
select '04. 2026-10-02-vue-mouvements',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'v_mouvements_recents' and column_name = 'lot')
union all
select '05. 2026-10-03-historique-recu-par', to_regclass('public.v_historique_entrees') is not null
union all
select '06. 2026-10-03-quarantaine', to_regclass('public.non_conformites') is not null
union all
select '07. 2026-10-27-commandes-fournisseurs', to_regclass('public.commandes_fournisseurs') is not null
union all
select '08. 2026-10-27-suivi-statuts-stock', to_regclass('public.historique_statuts_stock') is not null
union all
select '09. 2026-10-28-entree-multi-depots',
       pg_get_functiondef('public.creer_reception'::regproc) ilike '%v_entrepot_principal%'
union all
select '10. 2026-10-29-entree-annuler-modifier', to_regproc('public.annuler_reception') is not null
union all
select '11. 2026-10-30-sortie-recu-par-obligatoire',
       pg_get_functiondef('public.creer_sortie'::regproc) ilike '%Reçu par%'
union all
select '12. 2026-10-30-sortie-multi-depots',
       pg_get_functiondef('public.creer_sortie'::regproc) ilike '%v_entrepot_ligne%';

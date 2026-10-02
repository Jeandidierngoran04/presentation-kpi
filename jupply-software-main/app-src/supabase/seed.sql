-- Donnees de demo - Module Gestion des Stocks (schema V1 complet)
-- A executer APRES schema.sql, et APRES avoir cree ton entreprise + ton
-- profil Administrateur (voir instructions en bas de schema.sql).
--
-- Optionnel : pour varier les "utilisateurs" affiches dans les mouvements,
-- cree 2-3 comptes de plus dans Supabase (Authentication > Users > Add user),
-- puis pour chacun : insert into profiles (id, entreprise_id, nom_complet, role)
-- values ('<uid>', '<id-entreprise>', 'Prenom Nom', 'magasinier');
-- Ce script s'adapte automatiquement au nombre de profils existants.

do $$
declare
  v_entreprise_id uuid;
  v_entrepot_principal uuid;
  v_entrepot_secondaire uuid;
  v_emplacement_a uuid;
  v_emplacement_b uuid;
  v_emplacement_quarantaine uuid;
  v_cat_info uuid;
  v_cat_fourn uuid;
  v_cat_equip uuid;
  v_cat_conso uuid;
  v_cat_pieces uuid;
  v_cat_medic uuid;
  v_fournisseur_info uuid;
  v_fournisseur_medic uuid;
  v_fournisseur_bureau uuid;
  v_utilisateur_ids uuid[];
  v_nb_utilisateurs int;
  v_produit_id uuid;
  v_stock_avant int;
  v_stock_apres int;
  v_qte int;
  v_utilisateur_id uuid;
  v_compteur int := 1;
  v_type text;
  v_unite text;
  v_gere_lot boolean;
  v_gere_serie boolean;
  v_gere_expiration boolean;
  v_reception_id uuid;
  v_bon_sortie_id uuid;
  v_transfert_id uuid;
  v_inventaire_id uuid;
  v_produit_tmp uuid;
  v_produit_equiv uuid;
  rec record;
begin
  select id into v_entreprise_id from entreprises limit 1;
  if v_entreprise_id is null then
    raise exception 'Aucune entreprise trouvee. Cree d''abord une entreprise et un profil (voir instructions en bas de schema.sql).';
  end if;

  select array_agg(id) into v_utilisateur_ids from profiles where entreprise_id = v_entreprise_id;
  v_nb_utilisateurs := coalesce(array_length(v_utilisateur_ids, 1), 0);
  if v_nb_utilisateurs = 0 then
    raise exception 'Aucun profil utilisateur trouve pour cette entreprise.';
  end if;

  -- Entrepots (l'emplacement Quarantaine de chacun est cree automatiquement par trigger)
  insert into entrepots (entreprise_id, nom) values (v_entreprise_id, 'Entrepôt principal') returning id into v_entrepot_principal;
  insert into entrepots (entreprise_id, nom) values (v_entreprise_id, 'Entrepôt secondaire') returning id into v_entrepot_secondaire;

  insert into emplacements (entrepot_id, zone, rayon, etagere, code)
    values (v_entrepot_principal, 'Zone A', 'Rayon 1', 'Étagère 1', 'A1') returning id into v_emplacement_a;
  insert into emplacements (entrepot_id, zone, rayon, etagere, code)
    values (v_entrepot_principal, 'Zone B', 'Rayon 1', 'Étagère 1', 'B1');
  insert into emplacements (entrepot_id, zone, rayon, etagere, code)
    values (v_entrepot_secondaire, 'Zone A', 'Rayon 1', 'Étagère 1', 'A1') returning id into v_emplacement_b;

  select id into v_emplacement_quarantaine from emplacements where entrepot_id = v_entrepot_principal and est_quarantaine;

  -- Fournisseurs
  insert into fournisseurs (entreprise_id, nom, contact)
    values (v_entreprise_id, 'TechDistrib SARL', 'contact@techdistrib.example') returning id into v_fournisseur_info;
  insert into fournisseurs (entreprise_id, nom, contact)
    values (v_entreprise_id, 'MediPro Afrique', 'commandes@medipro.example') returning id into v_fournisseur_medic;
  insert into fournisseurs (entreprise_id, nom, contact)
    values (v_entreprise_id, 'Bureau Plus', 'ventes@bureauplus.example') returning id into v_fournisseur_bureau;

  -- Categories
  insert into categories (entreprise_id, nom) values (v_entreprise_id, 'Informatique') returning id into v_cat_info;
  insert into categories (entreprise_id, nom) values (v_entreprise_id, 'Fournitures de bureau') returning id into v_cat_fourn;
  insert into categories (entreprise_id, nom) values (v_entreprise_id, 'Équipements') returning id into v_cat_equip;
  insert into categories (entreprise_id, nom) values (v_entreprise_id, 'Consommables') returning id into v_cat_conso;
  insert into categories (entreprise_id, nom) values (v_entreprise_id, 'Pièces détachées') returning id into v_cat_pieces;
  insert into categories (entreprise_id, nom) values (v_entreprise_id, 'Produits médicaux') returning id into v_cat_medic;

  -- Produits : reference, designation, categorie, stock_min, quantite cible entrepot principal, quantite cible entrepot secondaire, prix
  for rec in
    select * from (values
      ('ART-0001', 'Papier A4', v_cat_fourn, 20, 5, 10, 3.50),
      ('ART-0002', 'Toner HP 305A', v_cat_fourn, 10, 0, 0, 65.00),
      ('ART-0003', 'Cartouche Canon 545', v_cat_fourn, 15, 3, 6, 22.00),
      ('ART-0004', 'Stylo bille bleu (boîte 50)', v_cat_fourn, 10, 32, 18, 8.50),
      ('ART-0005', 'Classeur A4', v_cat_fourn, 15, 40, 12, 2.20),
      ('ART-0006', 'Ordinateur portable Dell 14"', v_cat_info, 5, 12, 3, 550.00),
      ('ART-0007', 'Écran 24 pouces', v_cat_info, 5, 8, 2, 145.00),
      ('ART-0008', 'Clavier sans fil', v_cat_info, 10, 22, 9, 18.00),
      ('ART-0009', 'Souris optique', v_cat_info, 10, 27, 14, 9.00),
      ('ART-0010', 'Disque SSD 512 Go', v_cat_info, 8, 0, 0, 48.00),
      ('ART-0011', 'Câble réseau RJ45 (5m)', v_cat_info, 20, 45, 30, 3.00),
      ('ART-0012', 'Onduleur 650VA', v_cat_equip, 4, 6, 1, 75.00),
      ('ART-0013', 'Chariot de manutention', v_cat_equip, 2, 3, 1, 210.00),
      ('ART-0014', 'Transpalette manuel', v_cat_equip, 2, 2, 0, 320.00),
      ('ART-0015', 'Étagère de stockage métallique', v_cat_equip, 3, 9, 4, 90.00),
      ('ART-0016', 'Gants de manutention (paire)', v_cat_conso, 20, 60, 25, 3.20),
      ('ART-0017', 'Ruban adhésif d''emballage', v_cat_conso, 15, 38, 10, 1.80),
      ('ART-0018', 'Film étirable palette', v_cat_conso, 10, 14, 6, 12.00),
      ('ART-0019', 'Cartons d''emballage (lot de 20)', v_cat_conso, 15, 22, 8, 14.00),
      ('ART-0020', 'Étiquettes code-barres (rouleau)', v_cat_conso, 10, 17, 5, 6.50),
      ('ART-0021', 'Roulement à billes 608ZZ', v_cat_pieces, 25, 12, 40, 1.10),
      ('ART-0022', 'Courroie de transmission', v_cat_pieces, 6, 2, 3, 15.00),
      ('ART-0023', 'Filtre à air industriel', v_cat_pieces, 8, 0, 0, 22.00),
      ('ART-0024', 'Masques chirurgicaux (boîte 50)', v_cat_medic, 20, 55, 30, 9.90),
      ('ART-0025', 'Gel hydroalcoolique 500ml', v_cat_medic, 15, 9, 20, 3.50),
      ('ART-0026', 'Gants latex (boîte 100)', v_cat_medic, 20, 0, 12, 11.50)
    ) as t(reference, nom, categorie_id, stock_min, qte_principal, qte_secondaire, prix)
  loop
    v_type := case
      when rec.reference in ('ART-0013', 'ART-0014') then 'outillage'
      when rec.reference = 'ART-0012' then 'rotable'
      else 'consommable'
    end;
    v_unite := case
      when rec.reference in ('ART-0004', 'ART-0024', 'ART-0026') then 'boite'
      when rec.reference in ('ART-0017', 'ART-0020') then 'rouleau'
      when rec.reference = 'ART-0019' then 'lot'
      when rec.reference = 'ART-0025' then 'flacon'
      when rec.reference = 'ART-0016' then 'paire'
      else 'piece'
    end;
    v_gere_serie := rec.categorie_id = v_cat_info and rec.reference not in ('ART-0008', 'ART-0009', 'ART-0011');
    v_gere_lot := rec.categorie_id in (v_cat_pieces, v_cat_medic);
    v_gere_expiration := rec.categorie_id = v_cat_medic;

    insert into produits (
      entreprise_id, reference, designation, categorie_id, type, unite_mesure,
      prix_moyen_pondere, stock_min, stock_max, seuil_reappro, gere_lot, gere_numero_serie, gere_expiration
    )
    values (
      v_entreprise_id, rec.reference, rec.nom, rec.categorie_id, v_type, v_unite,
      rec.prix, rec.stock_min, rec.stock_min * 8, rec.stock_min + 5, v_gere_lot, v_gere_serie, v_gere_expiration
    )
    returning id into v_produit_id;

    if rec.categorie_id = v_cat_info then
      insert into produits_fournisseurs (produit_id, fournisseur_id) values (v_produit_id, v_fournisseur_info);
    elsif rec.categorie_id = v_cat_medic then
      insert into produits_fournisseurs (produit_id, fournisseur_id) values (v_produit_id, v_fournisseur_medic);
    elsif rec.categorie_id = v_cat_fourn then
      insert into produits_fournisseurs (produit_id, fournisseur_id) values (v_produit_id, v_fournisseur_bureau);
    end if;

    -- Entrepot principal : reception initiale puis sortie qui ramene au niveau cible
    v_utilisateur_id := v_utilisateur_ids[1 + (v_compteur % v_nb_utilisateurs)];
    v_stock_avant := 0;
    v_qte := rec.qte_principal + 2 + (v_compteur % 5);
    v_stock_apres := v_stock_avant + v_qte;
    insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, prix_unitaire, cree_le)
    values (v_entreprise_id, v_produit_id, v_entrepot_principal, v_emplacement_a, 'entree', v_qte, v_stock_avant, v_stock_apres, v_utilisateur_id, 'REC-' || lpad(v_compteur::text, 5, '0'), 'Réception fournisseur', rec.prix, now() - ((25 + v_compteur % 5) || ' days')::interval);
    v_stock_avant := v_stock_apres;

    v_qte := v_stock_avant - rec.qte_principal;
    v_stock_apres := rec.qte_principal;
    v_utilisateur_id := v_utilisateur_ids[1 + ((v_compteur + 1) % v_nb_utilisateurs)];
    insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, prix_unitaire, cree_le)
    values (v_entreprise_id, v_produit_id, v_entrepot_principal, v_emplacement_a, 'sortie', v_qte, v_stock_avant, v_stock_apres, v_utilisateur_id, 'BS-' || lpad(v_compteur::text, 5, '0'), 'Livraison client', rec.prix, now() - ((1 + v_compteur % 20) || ' days')::interval);

    insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
    values (v_produit_id, v_entrepot_principal, v_emplacement_a, rec.qte_principal);

    -- Entrepot secondaire : reception directe au niveau cible
    if rec.qte_secondaire > 0 then
      v_utilisateur_id := v_utilisateur_ids[1 + ((v_compteur + 2) % v_nb_utilisateurs)];
      insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, prix_unitaire, cree_le)
      values (v_entreprise_id, v_produit_id, v_entrepot_secondaire, v_emplacement_b, 'entree', rec.qte_secondaire, 0, rec.qte_secondaire, v_utilisateur_id, 'REC-' || lpad((1000 + v_compteur)::text, 5, '0'), 'Réception fournisseur', rec.prix, now() - ((10 + v_compteur % 15) || ' days')::interval);
    end if;
    insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
    values (v_produit_id, v_entrepot_secondaire, v_emplacement_b, rec.qte_secondaire);

    -- Quelques mouvements "aujourd'hui" pour peupler les KPI Entrees/Sorties du jour
    if v_compteur % 4 = 0 then
      v_utilisateur_id := v_utilisateur_ids[1 + (v_compteur % v_nb_utilisateurs)];
      insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, prix_unitaire, cree_le)
      values (v_entreprise_id, v_produit_id, v_entrepot_principal, v_emplacement_a, 'entree', 5, rec.qte_principal, rec.qte_principal + 5, v_utilisateur_id, 'REC-' || lpad((2000 + v_compteur)::text, 5, '0'), 'Réapprovisionnement', rec.prix, now() - interval '2 hours');
      update stock_produits set quantite = quantite + 5 where produit_id = v_produit_id and entrepot_id = v_entrepot_principal and emplacement_id = v_emplacement_a;
    elsif v_compteur % 4 = 1 and rec.qte_principal >= 3 then
      v_utilisateur_id := v_utilisateur_ids[1 + ((v_compteur + 3) % v_nb_utilisateurs)];
      insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, prix_unitaire, cree_le)
      values (v_entreprise_id, v_produit_id, v_entrepot_principal, v_emplacement_a, 'sortie', 3, rec.qte_principal, rec.qte_principal - 3, v_utilisateur_id, 'BS-' || lpad((2000 + v_compteur)::text, 5, '0'), 'Commande client', rec.prix, now() - interval '1 hour');
      update stock_produits set quantite = quantite - 3 where produit_id = v_produit_id and entrepot_id = v_entrepot_principal and emplacement_id = v_emplacement_a;
    end if;

    v_compteur := v_compteur + 1;
  end loop;

  -- Quelques unites de Cartouche Canon 545 placees en Quarantaine (anomalie a reception)
  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0003';
  insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
  values (v_produit_tmp, v_entrepot_principal, v_emplacement_quarantaine, 2);
  insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, cree_le)
  values (v_entreprise_id, v_produit_tmp, v_entrepot_principal, v_emplacement_quarantaine, 'ajustement', 2, 0, 2, v_utilisateur_ids[1], 'QAR-00001', 'Anomalie à réception - mis en quarantaine', now() - interval '4 days');

  -- Réceptions de démonstration (une validée, une avec lot/expiration, une en attente)
  insert into receptions (entreprise_id, numero, entrepot_id, fournisseur_id, numero_po, statut, cree_par, valide_par, valide_le, cree_le)
  values (v_entreprise_id, 'REC-2026-001', v_entrepot_principal, v_fournisseur_info, 'PO-4021', 'validee', v_utilisateur_ids[1], v_utilisateur_ids[1], now() - interval '5 days', now() - interval '6 days')
  returning id into v_reception_id;

  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0006';
  insert into receptions_lignes (reception_id, produit_id, emplacement_id, quantite_attendue, quantite_recue, numero_serie, prix_unitaire)
  values (v_reception_id, v_produit_tmp, v_emplacement_a, 5, 5, 'SN-DELL-0001', 550.00);
  insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, numero_serie, prix_unitaire, cree_le)
  values (v_entreprise_id, v_produit_tmp, v_entrepot_principal, v_emplacement_a, 'entree', 5, 12, 17, v_utilisateur_ids[1], 'REC-2026-001', 'PO-4021', 'SN-DELL-0001', 550.00, now() - interval '5 days');

  insert into receptions (entreprise_id, numero, entrepot_id, fournisseur_id, numero_po, statut, cree_par, valide_par, valide_le, cree_le)
  values (v_entreprise_id, 'REC-2026-002', v_entrepot_principal, v_fournisseur_medic, 'PO-4055', 'validee', v_utilisateur_ids[1], v_utilisateur_ids[1], now() - interval '3 days', now() - interval '4 days')
  returning id into v_reception_id;

  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0024';
  insert into receptions_lignes (reception_id, produit_id, emplacement_id, quantite_attendue, quantite_recue, lot, date_expiration, prix_unitaire)
  values (v_reception_id, v_produit_tmp, v_emplacement_a, 30, 30, 'LOT-2026-0825', (current_date + interval '18 months')::date, 9.90);
  insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, lot, prix_unitaire, cree_le)
  values (v_entreprise_id, v_produit_tmp, v_entrepot_principal, v_emplacement_a, 'entree', 30, 25, 55, v_utilisateur_ids[1], 'REC-2026-002', 'PO-4055', 'LOT-2026-0825', 9.90, now() - interval '3 days');

  insert into receptions (entreprise_id, numero, entrepot_id, fournisseur_id, numero_po, statut, cree_par, cree_le)
  values (v_entreprise_id, 'REC-2026-003', v_entrepot_secondaire, v_fournisseur_bureau, 'PO-4110', 'en_attente', v_utilisateur_ids[1], now() - interval '1 day')
  returning id into v_reception_id;

  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0001';
  insert into receptions_lignes (reception_id, produit_id, emplacement_id, quantite_attendue, quantite_recue, prix_unitaire)
  values (v_reception_id, v_produit_tmp, v_emplacement_b, 20, 0, 3.50);

  -- Bon de sortie de démonstration
  insert into bons_sortie (entreprise_id, numero, entrepot_id, demande_par, statut, motif, cree_le)
  values (v_entreprise_id, 'BS-2026-001', v_entrepot_principal, v_utilisateur_ids[1], 'confirmee', 'Livraison client Abidjan', now() - interval '2 days')
  returning id into v_bon_sortie_id;

  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0008';
  insert into bons_sortie_lignes (bon_sortie_id, produit_id, emplacement_id, quantite)
  values (v_bon_sortie_id, v_produit_tmp, v_emplacement_a, 4);

  -- Transfert en cours (statut "en_transit") entre les deux entrepots
  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0007';
  insert into transferts (entreprise_id, numero_suivi, entrepot_source_id, entrepot_destination_id, statut, demande_par, valide_par, cree_le, expedie_le)
  values (v_entreprise_id, 'TRF-2026-001', v_entrepot_principal, v_entrepot_secondaire, 'en_transit', v_utilisateur_ids[1], v_utilisateur_ids[1], now() - interval '2 days', now() - interval '1 day')
  returning id into v_transfert_id;

  insert into transferts_lignes (transfert_id, produit_id, quantite_expediee)
  values (v_transfert_id, v_produit_tmp, 3);

  -- Inventaire partiel en cours sur l'entrepot principal
  insert into inventaires (entreprise_id, entrepot_id, type, statut, demarre_par, cree_le)
  values (v_entreprise_id, v_entrepot_principal, 'partiel', 'en_cours', v_utilisateur_ids[1], now() - interval '3 hours')
  returning id into v_inventaire_id;

  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0009';
  select quantite into v_qte from stock_produits where produit_id = v_produit_tmp and entrepot_id = v_entrepot_principal and emplacement_id = v_emplacement_a;
  insert into inventaires_lignes (inventaire_id, produit_id, emplacement_id, stock_theorique)
  values (v_inventaire_id, v_produit_tmp, v_emplacement_a, coalesce(v_qte, 0));

  -- Outillage : un chariot de manutention affecté au service logistique
  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0013';
  insert into affectations_outillage (entreprise_id, produit_id, entrepot_id, beneficiaire, date_affectation, statut, affecte_par, cree_le)
  values (v_entreprise_id, v_produit_tmp, v_entrepot_principal, 'Service Logistique', (current_date - interval '10 days')::date, 'affecte', v_utilisateur_ids[1], now() - interval '10 days');

  -- Produit équivalent de démonstration (référence compatible d'un autre fabricant)
  select id into v_produit_tmp from produits where entreprise_id = v_entreprise_id and reference = 'ART-0021';
  insert into produits (entreprise_id, reference, designation, categorie_id, type, unite_mesure, prix_moyen_pondere, stock_min, stock_max, seuil_reappro, gere_lot)
  values (v_entreprise_id, 'ART-0027', 'Roulement à billes 608ZZ (compatible)', v_cat_pieces, 'consommable', 'piece', 0.95, 15, 100, 20, true)
  returning id into v_produit_equiv;
  insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite) values (v_produit_equiv, v_entrepot_principal, v_emplacement_a, 18);
  insert into mouvements_stock (entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite, stock_avant, stock_apres, utilisateur_id, reference, motif, prix_unitaire, cree_le)
  values (v_entreprise_id, v_produit_equiv, v_entrepot_principal, v_emplacement_a, 'entree', 18, 0, 18, v_utilisateur_ids[1], 'REC-2026-004', 'Réception fournisseur', 0.95, now() - interval '7 days');
  insert into produits_equivalents (produit_id, produit_equivalent_id) values (v_produit_tmp, v_produit_equiv), (v_produit_equiv, v_produit_tmp);
end $$;

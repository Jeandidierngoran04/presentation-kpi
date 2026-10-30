-- Sortie multi-dépôts (30/10/2026)
--
-- Une sortie (un seul numéro BS) peut prendre des produits dans plusieurs
-- dépôts : le dépôt de chaque ligne est celui de sa localisation
-- (bons_sortie_lignes.emplacement_id -> emplacements.entrepot_id), aucune
-- nouvelle colonne. L'en-tête (bons_sortie.entrepot_id) garde le dépôt
-- "principal" (celui de la première ligne).
--
-- - creer_sortie : stock, lots et mouvements dans le dépôt de chaque ligne ;
--   chaque localisation doit appartenir à un dépôt visible de l'utilisateur.
-- - creer_reintegration : une ligne revient dans le dépôt d'où elle est sortie.
-- - v_sorties_a_reintegrer : chaque ligne avec son vrai dépôt.
--
-- Mêmes signatures et mêmes colonnes qu'avant. À exécuter après
-- 2026-10-30-sortie-recu-par-obligatoire.sql. Re-exécutable.

begin;

create or replace function creer_sortie(
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

create or replace view v_sorties_a_reintegrer with (security_invoker = true) as
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

notify pgrst, 'reload schema';

commit;

-- Sortie : « Reçu par » obligatoire (30/10/2026)
--
-- Une sortie est toujours destinée à quelqu'un : une personne, ou un service
-- (ex. Logistique, Supply chain) quand c'est l'équipe elle-même qui prend.
-- creer_sortie refuse désormais une sortie sans « Reçu par ». Même signature
-- qu'avant. Les sorties déjà enregistrées ne sont pas modifiées.
-- À exécuter après 2026-10-29-entree-annuler-modifier.sql. Re-exécutable.

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
begin
  select entreprise_id into v_entreprise_id from entrepots where id = p_entrepot_id;
  if v_entreprise_id is null then
    raise exception 'Entrepot introuvable.';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une sortie doit contenir au moins une ligne.';
  end if;
  -- Une sortie est toujours destinée à quelqu'un (une personne, ou un service : Logistique...).
  if nullif(btrim(coalesce(p_recu_par, '')), '') is null then
    raise exception 'Le champ « Reçu par » est obligatoire : indique qui reçoit la sortie (une personne ou un service).';
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

notify pgrst, 'reload schema';

commit;

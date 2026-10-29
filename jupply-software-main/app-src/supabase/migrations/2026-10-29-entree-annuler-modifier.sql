-- Entree : annuler, modifier, valider une seule fois (29/10/2026)
--
-- - Nouveau statut "annulee" (avec qui, quand, motif) : une entree annulee
--   ne touche jamais au stock.
-- - annuler_reception(id, motif) et modifier_reception(id, fournisseur,
--   lignes, notes, date) : seulement une entree en attente, par son auteur
--   ou un role qui peut valider.
-- - ajouter_lignes_reception : controles des lignes partages entre la
--   creation et la modification (creer_reception l'utilise desormais).
-- - valider_reception : refuse une entree deja validee ou annulee (verrou
--   contre la double validation).
--
-- A executer apres 2026-10-28-entree-multi-depots.sql. Re-executable.

begin;

alter table receptions drop constraint if exists receptions_statut_check;
alter table receptions add constraint receptions_statut_check
  check (statut in ('en_attente', 'validee', 'partielle', 'anomalie', 'annulee'));
alter table receptions add column if not exists annulee_par uuid references profiles(id);
alter table receptions add column if not exists annulee_le timestamptz;
alter table receptions add column if not exists motif_annulation text;

drop policy if exists "modification receptions en attente par l'auteur" on receptions;
drop policy if exists "suppression lignes receptions en attente" on receptions_lignes;
-- L'auteur d'une entree en attente peut l'annuler ou la modifier (les roles
-- de validation le peuvent deja via "validation receptions"). Il ne peut pas
-- la passer en validee : seuls les statuts en_attente / annulee sont permis.
create policy "modification receptions en attente par l'auteur" on receptions
  for update using (
    entrepot_id in (select entrepots_visibles()) and cree_par = auth.uid() and statut = 'en_attente'
  )
  with check (
    entrepot_id in (select entrepots_visibles()) and cree_par = auth.uid() and statut in ('en_attente', 'annulee')
  );

-- Remplacement des lignes d'une entree en attente (modification).
create policy "suppression lignes receptions en attente" on receptions_lignes
  for delete using (
    reception_id in (
      select id from receptions
      where statut = 'en_attente'
        and entrepot_id in (select entrepots_visibles())
        and (cree_par = auth.uid() or role_courant() in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot'))
    )
  );

-- Ajoute les lignes d'une entree (creation ou modification), avec les memes
-- controles : localisation existante dans un depot visible de l'entreprise,
-- date d'expiration et lot, non-conformite. Le depot de chaque ligne est
-- celui de sa localisation.
create or replace function ajouter_lignes_reception(p_reception_id uuid, p_entreprise_id uuid, p_lignes jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  v_ligne jsonb;
  v_gere_expiration boolean;
  v_reference text;
  v_quantite_recue integer;
  v_quantite_nc integer;
  v_motif_nc text;
  v_entrepot_ligne uuid;
begin
  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    select gere_expiration, reference into v_gere_expiration, v_reference
      from produits where id = (v_ligne->>'produit_id')::uuid;

    select e.entrepot_id into v_entrepot_ligne
      from emplacements e where e.id = nullif(v_ligne->>'emplacement_id', '')::uuid;
    -- Une localisation d'un depot non attribue est invisible (securite) : meme message.
    if v_entrepot_ligne is null then
      raise exception 'Produit % : localisation introuvable ou depot non autorise.', v_reference;
    end if;
    if v_entrepot_ligne not in (select entrepots_visibles()) then
      raise exception 'Produit % : vous n''avez pas acces au depot de cette localisation.', v_reference;
    end if;
    if not exists (select 1 from entrepots where id = v_entrepot_ligne and entreprise_id = p_entreprise_id) then
      raise exception 'Produit % : le depot n''appartient pas a votre entreprise.', v_reference;
    end if;

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
      p_reception_id,
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
end;
$$;

grant execute on function ajouter_lignes_reception to authenticated;

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
  v_entrepot_principal uuid;
begin
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une reception doit contenir au moins une ligne.';
  end if;

  -- Une entree peut couvrir plusieurs depots : le depot de chaque ligne est
  -- celui de sa localisation. L'en-tete garde un depot "principal" (celui
  -- passe en parametre, sinon celui de la premiere ligne).
  v_entrepot_principal := coalesce(
    p_entrepot_id,
    (select e.entrepot_id from emplacements e where e.id = (p_lignes->0->>'emplacement_id')::uuid)
  );
  if v_entrepot_principal is null then
    raise exception 'Ligne 1 : localisation introuvable ou depot non autorise.';
  end if;
  select entreprise_id into v_entreprise_id from entrepots where id = v_entrepot_principal;
  if v_entreprise_id is null then
    raise exception 'Entrepot introuvable.';
  end if;

  v_date := coalesce(p_date_mouvement, now());
  v_numero := 'REC-' || to_char(v_date, 'YYYY') || '-' || lpad(nextval('receptions_numero_seq')::text, 5, '0');

  insert into receptions (entreprise_id, numero, entrepot_id, fournisseur_id, numero_po, statut, cree_par, notes, cree_le)
  values (
    v_entreprise_id, v_numero, v_entrepot_principal, p_fournisseur_id, nullif(p_numero_po, ''), 'en_attente', auth.uid(),
    nullif(p_notes, ''), v_date
  )
  returning id into v_reception_id;

  perform ajouter_lignes_reception(v_reception_id, v_entreprise_id, p_lignes);

  return v_reception_id;
end;
$$;

grant execute on function creer_reception to authenticated;

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
  v_entrepot_ligne uuid;
  v_statut_actuel text;
begin
  -- Verrou : deux validations simultanees ne peuvent pas ajouter deux fois le stock.
  select statut into v_statut_actuel from receptions where id = p_reception_id for update;
  if v_statut_actuel is not null and v_statut_actuel <> 'en_attente' then
    raise exception 'Cette entree n''est plus en attente (deja validee ou annulee).';
  end if;

  select entreprise_id, entrepot_id, numero, cree_le, fournisseur_id, numero_po
    into v_entreprise_id, v_entrepot_id, v_numero, v_date_entree, v_fournisseur_id, v_numero_po
    from receptions where id = p_reception_id;

  if v_entrepot_id is null then
    raise exception 'Reception introuvable.';
  end if;

  for v_ligne in select * from receptions_lignes where reception_id = p_reception_id
  loop
    -- Depot de la ligne = depot de sa localisation (une entree peut couvrir
    -- plusieurs depots) ; a defaut, le depot de l'en-tete.
    v_entrepot_ligne := coalesce(
      (select e.entrepot_id from emplacements e where e.id = v_ligne.emplacement_id),
      v_entrepot_id
    );
    select id into v_quarantaine_id from emplacements where entrepot_id = v_entrepot_ligne and est_quarantaine;
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
        where produit_id = v_ligne.produit_id and entrepot_id = v_entrepot_ligne and emplacement_id = v_ligne.emplacement_id;
      v_stock_avant := coalesce(v_stock_avant, 0);
      v_stock_apres := v_stock_avant + v_qte_normale;

      -- Le lot d'abord, le stock ensuite (voir synchroniser_lots).
      perform ajouter_lot(
        v_ligne.produit_id, v_entrepot_ligne, v_ligne.emplacement_id, v_ligne.lot, v_ligne.numero_serie,
        v_ligne.date_expiration, v_date_entree, v_ligne.prix_unitaire, v_qte_normale
      );

      insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
      values (v_ligne.produit_id, v_entrepot_ligne, v_ligne.emplacement_id, v_qte_normale)
      on conflict (produit_id, entrepot_id, emplacement_id)
      do update set quantite = stock_produits.quantite + excluded.quantite;

      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite,
        stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, prix_unitaire
      )
      values (
        v_entreprise_id, v_ligne.produit_id, v_entrepot_ligne, v_ligne.emplacement_id, 'entree', v_qte_normale,
        v_stock_avant, v_stock_apres, auth.uid(), v_numero, 'Réception validée',
        v_ligne.lot, v_ligne.numero_serie, v_ligne.prix_unitaire
      );
    end if;

    if v_qte_quarantaine > 0 then
      v_numero_nc := 'NC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('non_conformites_numero_seq')::text, 5, '0');

      select quantite into v_stock_avant from stock_produits
        where produit_id = v_ligne.produit_id and entrepot_id = v_entrepot_ligne and emplacement_id = v_quarantaine_id;
      v_stock_avant := coalesce(v_stock_avant, 0);
      v_stock_apres := v_stock_avant + v_qte_quarantaine;

      perform ajouter_lot(
        v_ligne.produit_id, v_entrepot_ligne, v_quarantaine_id, v_ligne.lot, v_ligne.numero_serie,
        v_ligne.date_expiration, v_date_entree, v_ligne.prix_unitaire, v_qte_quarantaine
      );

      insert into stock_produits (produit_id, entrepot_id, emplacement_id, quantite)
      values (v_ligne.produit_id, v_entrepot_ligne, v_quarantaine_id, v_qte_quarantaine)
      on conflict (produit_id, entrepot_id, emplacement_id)
      do update set quantite = stock_produits.quantite + excluded.quantite;

      insert into mouvements_stock (
        entreprise_id, produit_id, entrepot_id, emplacement_id, type, quantite,
        stock_avant, stock_apres, utilisateur_id, reference, motif, lot, numero_serie, prix_unitaire
      )
      values (
        v_entreprise_id, v_ligne.produit_id, v_entrepot_ligne, v_quarantaine_id, 'entree', v_qte_quarantaine,
        v_stock_avant, v_stock_apres, auth.uid(), v_numero, 'Non-conformité à réception - Quarantaine (' || v_numero_nc || ')',
        v_ligne.lot, v_ligne.numero_serie, v_ligne.prix_unitaire
      );

      insert into non_conformites (
        entreprise_id, numero, entrepot_id, emplacement_id, produit_id, lot, numero_serie, date_expiration,
        date_entree_lot, prix_unitaire, origine, reception_id, fournisseur_id, numero_po, motif, constat,
        quantite_initiale, quantite_restante, declare_par
      )
      values (
        v_entreprise_id, v_numero_nc, v_entrepot_ligne, v_quarantaine_id, v_ligne.produit_id, v_ligne.lot,
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

-- Annule une entree en attente : aucun mouvement de stock. Motif obligatoire.
-- Autorise : l'auteur de l'entree, ou un role qui peut valider.
create or replace function annuler_reception(p_reception_id uuid, p_motif text)
returns void
language plpgsql
security invoker
as $$
declare
  v_statut text;
  v_cree_par uuid;
begin
  if nullif(btrim(coalesce(p_motif, '')), '') is null then
    raise exception 'Le motif d''annulation est obligatoire.';
  end if;
  -- Lecture simple d'abord (messages clairs), verrou ensuite.
  select statut, cree_par into v_statut, v_cree_par from receptions where id = p_reception_id;
  if v_statut is null then
    raise exception 'Entree introuvable, ou vous ne pouvez pas la modifier.';
  end if;
  if v_statut <> 'en_attente' then
    raise exception 'Seule une entree en attente peut etre annulee.';
  end if;
  if v_cree_par <> auth.uid() and role_courant() not in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot') then
    raise exception 'Seuls l''auteur de l''entree et les responsables peuvent l''annuler.';
  end if;
  perform 1 from receptions where id = p_reception_id for update;

  update receptions
     set statut = 'annulee', annulee_par = auth.uid(), annulee_le = now(), motif_annulation = btrim(p_motif)
   where id = p_reception_id;
end;
$$;

grant execute on function annuler_reception to authenticated;

-- Modifie une entree en attente : fournisseur, note, date et lignes (les
-- lignes sont remplacees, avec les memes controles qu'a la creation). Le
-- numero est conserve. Autorise : l'auteur de l'entree, ou un role qui peut valider.
create or replace function modifier_reception(
  p_reception_id uuid,
  p_fournisseur_id uuid,
  p_lignes jsonb,
  p_notes text default null,
  p_date_mouvement timestamptz default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_statut text;
  v_cree_par uuid;
  v_entreprise_id uuid;
  v_entrepot_principal uuid;
begin
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) = 0 then
    raise exception 'Une reception doit contenir au moins une ligne.';
  end if;
  select statut, cree_par, entreprise_id into v_statut, v_cree_par, v_entreprise_id
    from receptions where id = p_reception_id;
  if v_statut is null then
    raise exception 'Entree introuvable, ou vous ne pouvez pas la modifier.';
  end if;
  if v_statut <> 'en_attente' then
    raise exception 'Seule une entree en attente peut etre modifiee.';
  end if;
  if v_cree_par <> auth.uid() and role_courant() not in ('administrateur', 'superviseur_entrepot', 'gestionnaire_entrepot') then
    raise exception 'Seuls l''auteur de l''entree et les responsables peuvent la modifier.';
  end if;
  perform 1 from receptions where id = p_reception_id for update;

  v_entrepot_principal := (select e.entrepot_id from emplacements e where e.id = (p_lignes->0->>'emplacement_id')::uuid);
  if v_entrepot_principal is null then
    raise exception 'Ligne 1 : localisation introuvable ou depot non autorise.';
  end if;

  delete from receptions_lignes where reception_id = p_reception_id;
  -- Une regle de securite qui bloquerait la suppression le ferait sans erreur : on verifie.
  if exists (select 1 from receptions_lignes where reception_id = p_reception_id) then
    raise exception 'Les anciennes lignes n''ont pas pu etre remplacees.';
  end if;
  perform ajouter_lignes_reception(p_reception_id, v_entreprise_id, p_lignes);

  update receptions
     set fournisseur_id = p_fournisseur_id,
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         entrepot_id = v_entrepot_principal,
         cree_le = coalesce(p_date_mouvement, cree_le)
   where id = p_reception_id;
end;
$$;

grant execute on function modifier_reception to authenticated;

notify pgrst, 'reload schema';

commit;

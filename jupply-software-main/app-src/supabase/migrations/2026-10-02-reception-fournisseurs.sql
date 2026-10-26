-- Migration du 02/10/2026 : notes et date du mouvement sur les receptions,
-- coordonnees completes des fournisseurs.
-- Peut etre re-executee sans risque (deja executee ou non).
--
-- A executer dans l'editeur SQL de Supabase (ou via
-- scripts/run-sql.mjs). Ne modifie aucune donnee existante. schema.sql
-- contient deja la nouvelle definition.

begin;

alter table receptions add column if not exists notes text;
alter table receptions_lignes
  add column if not exists quantite_non_conforme integer not null default 0,
  add column if not exists motif_non_conformite text,
  add column if not exists constat_non_conformite text;

alter table fournisseurs
  add column if not exists telephone text,
  add column if not exists email text,
  add column if not exists adresse text,
  add column if not exists ville text,
  add column if not exists pays text;

-- L'ancienne version (4 parametres) est remplacee, pour qu'il n'existe
-- qu'une seule fonction creer_reception.
drop function if exists creer_reception(uuid, uuid, text, jsonb);

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
  v_ligne jsonb;
  v_gere_expiration boolean;
  v_reference text;
  v_quantite_recue integer;
  v_quantite_nc integer;
  v_motif_nc text;
begin
  select entreprise_id into v_entreprise_id from entrepots where id = p_entrepot_id;
  if v_entreprise_id is null then
    raise exception 'Entrepot introuvable.';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une reception doit contenir au moins une ligne.';
  end if;

  v_date := coalesce(p_date_mouvement, now());
  v_numero := 'REC-' || to_char(v_date, 'YYYY') || '-' || lpad(nextval('receptions_numero_seq')::text, 5, '0');

  insert into receptions (entreprise_id, numero, entrepot_id, fournisseur_id, numero_po, statut, cree_par, notes, cree_le)
  values (
    v_entreprise_id, v_numero, p_entrepot_id, p_fournisseur_id, nullif(p_numero_po, ''), 'en_attente', auth.uid(),
    nullif(p_notes, ''), v_date
  )
  returning id into v_reception_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    select gere_expiration, reference into v_gere_expiration, v_reference
      from produits where id = (v_ligne->>'produit_id')::uuid;

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
      v_reception_id,
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

  return v_reception_id;
end;
$$;

grant execute on function creer_reception to authenticated;

-- Recharge le cache de l'API Supabase pour qu'elle voie la nouvelle signature.
notify pgrst, 'reload schema';

commit;

-- Apparence de l'entreprise (écran Paramètre > Administration) : logo,
-- couleurs, polices, tailles. Une seule apparence par entreprise, vue par
-- tous ses utilisateurs ; seul l'Administrateur la modifie.
-- Le logo est rangé dans l'apparence (image réduite, quelques dizaines de ko).

alter table entreprises add column if not exists apparence jsonb not null default '{}'::jsonb;

create or replace function enregistrer_apparence(p_nom text, p_apparence jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if role_courant() is distinct from 'administrateur' then
    raise exception 'Seul l''Administrateur peut modifier l''apparence.';
  end if;
  if p_apparence is null or jsonb_typeof(p_apparence) <> 'object' then
    raise exception 'Apparence invalide.';
  end if;
  -- Garde-fou : un logo trop lourd ralentirait chaque ouverture de l'application.
  if length(p_apparence::text) > 1500000 then
    raise exception 'Logo trop lourd : choisis une image plus petite.';
  end if;

  update entreprises
     set nom = coalesce(nullif(btrim(p_nom), ''), nom),
         apparence = p_apparence
   where id = current_entreprise_id();
end;
$$;

grant execute on function enregistrer_apparence(text, jsonb) to authenticated;

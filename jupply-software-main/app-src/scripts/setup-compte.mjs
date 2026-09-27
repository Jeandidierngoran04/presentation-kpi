// Cree l'entreprise et le profil lies a un compte auth Supabase existant (identifie par e-mail).
// Usage : node --env-file=.env.local scripts/setup-compte.mjs "email@exemple.com" "Nom Entreprise" "Nom Complet"

import { Client } from 'pg'

const [, , email, nomEntreprise, nomComplet] = process.argv
if (!email || !nomEntreprise || !nomComplet) {
  console.error('Usage : node --env-file=.env.local scripts/setup-compte.mjs <email> <nom-entreprise> <nom-complet>')
  process.exit(1)
}

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const { rows: utilisateurs } = await client.query('select id from auth.users where email = $1', [email])
  if (utilisateurs.length === 0) {
    console.error(`Aucun compte auth trouve pour ${email}. Cree-le d'abord dans Supabase (Authentication > Users).`)
    process.exit(1)
  }
  const userId = utilisateurs[0].id

  const { rows: profilsExistants } = await client.query('select entreprise_id from profiles where id = $1', [userId])
  if (profilsExistants.length > 0) {
    console.log(`OK : profil deja existant, entreprise_id = ${profilsExistants[0].entreprise_id}`)
    process.exit(0)
  }

  const { rows: entreprises } = await client.query(
    'insert into entreprises (nom) values ($1) returning id',
    [nomEntreprise],
  )
  const entrepriseId = entreprises[0].id

  await client.query(
    'insert into profiles (id, entreprise_id, nom_complet, role) values ($1, $2, $3, $4)',
    [userId, entrepriseId, nomComplet, 'administrateur'],
  )

  console.log(`OK : entreprise "${nomEntreprise}" creee (${entrepriseId}), profil lie a ${email}.`)
} catch (erreur) {
  console.error('Echec :', erreur.message)
  process.exit(1)
} finally {
  await client.end()
}

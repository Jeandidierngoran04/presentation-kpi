// Execute un fichier .sql contre la base Supabase via SUPABASE_DB_URL (.env.local).
// Usage : node --env-file=.env.local scripts/run-sql.mjs supabase/schema.sql

import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

const cheminFichier = process.argv[2]
if (!cheminFichier) {
  console.error('Usage : node --env-file=.env.local scripts/run-sql.mjs <fichier.sql>')
  process.exit(1)
}

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('SUPABASE_DB_URL est vide dans .env.local.')
  process.exit(1)
}

const sql = await readFile(cheminFichier, 'utf8')
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(sql)
  console.log(`OK : ${cheminFichier} execute avec succes.`)
} catch (erreur) {
  console.error(`Echec sur ${cheminFichier} :`)
  console.error(erreur.message)
  process.exit(1)
} finally {
  await client.end()
}

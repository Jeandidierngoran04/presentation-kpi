import { Client } from 'pg'

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const { rows: produits } = await client.query('select count(*) from produits')
const { rows: mouvements } = await client.query('select count(*) from mouvements_stock')
const { rows: statuts } = await client.query('select statut, count(*) from v_produits_stock group by statut')

console.log('Produits :', produits[0].count)
console.log('Mouvements :', mouvements[0].count)
console.log('Repartition statuts :', statuts)

await client.end()

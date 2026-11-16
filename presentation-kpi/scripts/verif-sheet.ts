/**
 * Vérifie qu'une réponse du script Google (JSON) est bien comprise par l'application.
 * Usage : npx tsx scripts/verif-sheet.ts chemin/vers/reponse.json
 */
import fs from 'fs'
import { normaliser } from '../src/lib/source'

const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const { lignes, rejets } = normaliser(j.lignes)
console.log('lu :', j.lignes.length, '| accepté :', lignes.length, '| rejeté :', rejets.length)
rejets.forEach((r) => console.log('  REJET', r))
const t = (type: string, ind: string) =>
  lignes
    .filter((l) => l.type === type && l.indicateur === ind)
    .map((l) => `${l.periode} ${l.pays}=${l.valeur}`)
    .join(', ')
const ids = [...new Set(lignes.map((l) => l.indicateur))].sort()
for (const ind of ids) console.log(ind.padEnd(24), '| S:', t('semaine', ind) || '-', '| M:', t('mois', ind) || '-')

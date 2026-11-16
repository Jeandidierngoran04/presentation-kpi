/** Affiche ce que l'application comprend de la copie de la feuille « Donnée ». Usage : npx tsx scripts/verif-copie.ts */
import { GRILLES_COPIE } from '../src/lib/copieDonnee'
import { lireFeuilles } from '../src/lib/feuilleDonnee'
import { normaliser } from '../src/lib/source'

const { lignes, rejets } = normaliser(lireFeuilles(GRILLES_COPIE))
console.log('accepté :', lignes.length, '| rejeté :', rejets.length)
rejets.forEach((r) => console.log('  REJET', r))
for (const id of [...new Set(lignes.map((l) => l.indicateur))].sort())
  console.log(
    id.padEnd(24),
    lignes.filter((l) => l.indicateur === id).map((l) => `${l.type === 'mois' ? 'M' : 'S'}${l.periode.slice(5)} ${l.pays}=${l.valeur}`).join(', '),
  )

/** Liste mondiale des pays, noms en français, générée par le navigateur (codes ISO). */
const EXCLUS = new Set(['AC', 'CP', 'CQ', 'DG', 'EA', 'EU', 'EZ', 'IC', 'QO', 'TA', 'UN', 'XA', 'XB', 'ZZ'])

const NOMS_COURTS: Record<string, string> = {
  CD: 'RDC',
  CG: 'Congo',
}

export type Pays = { code: string; nom: string }

function construire(): Pays[] {
  const dn = new Intl.DisplayNames(['fr'], { type: 'region', fallback: 'none' })
  const liste: Pays[] = []
  const A = 'A'.charCodeAt(0)
  for (let i = 0; i < 26; i++)
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i) + String.fromCharCode(A + j)
      if (EXCLUS.has(code)) continue
      // Anciens codes que le navigateur connaît encore (DY = Dahomey → Bénin, ZR = Zaïre → RDC…) : ignorés
      try {
        if (Intl.getCanonicalLocales(`und-${code}`)[0].split('-')[1] !== code) continue
      } catch {
        continue
      }
      let nom: string | undefined
      try {
        nom = dn.of(code)
      } catch {
        nom = undefined
      }
      if (nom && nom !== code) liste.push({ code, nom: NOMS_COURTS[code] ?? nom })
    }
  return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

export const PAYS: Pays[] = construire()
const INDEX = new Map(PAYS.map((p) => [p.code, p.nom]))
export const nomPays = (code: string) => INDEX.get(code) ?? code

const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
export const chercherPays = (q: string) => {
  const n = sansAccents(q.trim())
  if (!n) return PAYS
  return PAYS.filter((p) => sansAccents(p.nom).includes(n) || p.code.toLowerCase() === n)
}

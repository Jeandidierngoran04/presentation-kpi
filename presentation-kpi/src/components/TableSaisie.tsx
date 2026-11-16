import { RotateCcw } from 'lucide-react'
import { Drapeau } from './Drapeau'
import { ARTICLES, CATALOGUE } from '../lib/catalogue'
import { fmt } from '../lib/format'
import { nomPays } from '../lib/pays'
import { cleLigne } from '../lib/saisie'
import type { Famille, Ligne, Unite } from '../lib/types'

export const lireNombre = (t: string) => {
  const m = t.replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

export function lignesDeFamille(f: Famille): { id: string; libelle: string; unite?: Unite }[] {
  if (f === 'consommables')
    return ARTICLES.flatMap((a) => [
      { id: `couverture.${a.id}`, libelle: `Couverture ${a.libelle}`, unite: 'mois' as Unite },
      { id: `stock_conso.${a.id}`, libelle: `Stock ${a.libelle}`, unite: 'nb' as Unite },
    ])
  return CATALOGUE.filter((i) => i.famille === f).map((i) => ({ id: i.id, libelle: i.libelle, unite: i.unite }))
}

const virgule = (v: number) => String(v).replace('.', ',')

/**
 * Tableau indicateurs × pays pour une période : le chiffre du Sheet en gris (placeholder),
 * la valeur saisie en bleu (elle l'emporte), ↺ pour revenir au Sheet.
 */
export function TableSaisie({
  type,
  periode,
  famille,
  pays,
  valeurs,
  reference = [],
  onChange,
  cibles,
}: {
  type: Ligne['type']
  periode?: string
  famille: Famille
  pays: string[]
  /** Valeurs saisies (modifiables) */
  valeurs: Ligne[]
  /** Valeurs de référence affichées en gris (ex. chiffres du Sheet) */
  reference?: Ligne[]
  onChange: (valeurs: Ligne[]) => void
  /** Afficher la cible de chaque élément et pays (KPI manuels) */
  cibles?: (indicateur: string, pays: string) => number | undefined
}) {
  const lignes = lignesDeFamille(famille)
  const trouver = (src: Ligne[], p: string, ind: string) =>
    periode ? src.find((l) => l.type === type && l.periode === periode && l.pays === p && l.indicateur === ind && !l.agence) : undefined

  const ecrire = (p: string, ind: string, texte: string) => {
    if (!periode) return
    const cle = cleLigne({ type, periode, pays: p, indicateur: ind })
    const autres = valeurs.filter((l) => cleLigne(l) !== cle)
    const v = texte.trim() === '' ? undefined : lireNombre(texte)
    onChange(v == null ? autres : [...autres, { type, periode, pays: p, indicateur: ind, valeur: v }])
  }

  if (!lignes.length)
    return <div className="rounded-2xl border-2 border-dashed border-grille py-8 text-center text-muted text-sm">Aucun indicateur dans cette rubrique.</div>

  return (
    <div className="overflow-x-auto rounded-2xl border border-ligne bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-page text-ink-2">
            <th className="text-left font-medium px-4 py-2.5 min-w-[170px]">Indicateur</th>
            {pays.map((p) => (
              <th key={p} className="font-medium px-2 py-2.5 min-w-[104px]">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Drapeau code={p} taille={14} />
                  {nomPays(p)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.id} className="border-t border-ligne">
              <td className="px-4 py-2 font-medium">{l.libelle}</td>
              {pays.map((p) => {
                const s = trouver(valeurs, p, l.id)
                const d = trouver(reference, p, l.id)
                const c = cibles?.(l.id, p)
                const actuel = s?.valeur != null ? virgule(s.valeur) : ''
                return (
                  <td key={p} className="px-2 py-1.5">
                    <div className="relative">
                      <input
                        key={`${periode}-${type}-${p}-${l.id}-${actuel}`}
                        defaultValue={actuel}
                        disabled={!periode}
                        inputMode="decimal"
                        placeholder={d?.valeur != null ? virgule(d.valeur) : c != null ? `cible ${virgule(c)}` : '—'}
                        onBlur={(e) => e.target.value !== actuel && ecrire(p, l.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className={`chiffres w-full rounded-lg border px-2.5 py-1.5 text-right outline-none focus:border-bleu-450 placeholder:text-muted/70 ${s ? 'bg-bleu-100 border-bleu-250 font-semibold' : 'bg-white border-ligne'}`}
                        title={d?.valeur != null ? `Sheet : ${fmt(d.valeur, l.unite)}` : c != null ? `Cible : ${fmt(c, l.unite)}` : ''}
                      />
                      {s && reference.length > 0 && (
                        <button
                          onClick={() => ecrire(p, l.id, '')}
                          className="absolute -right-1 -top-1.5 grid place-items-center w-4 h-4 rounded-full bg-white border border-ligne text-muted hover:text-alerte"
                          title="Revenir au chiffre du Sheet"
                        >
                          <RotateCcw size={9} />
                        </button>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

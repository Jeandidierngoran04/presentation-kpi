import { Plus, Trash2 } from 'lucide-react'
import { nomPays } from '../lib/pays'
import type { Notes } from '../lib/types'

const VIDE: Notes = { divers: [], axes: [], problemes: [] }
const nouvelId = () => crypto.randomUUID()

const champ = 'w-full rounded-xl border border-ligne bg-page px-3 py-2 outline-none focus:border-bleu-450 focus:bg-white'

function Ajouter({ onClick, texte }: { onClick: () => void; texte: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 rounded-full border border-dashed border-base px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink hover:border-ink-2">
      <Plus size={16} /> {texte}
    </button>
  )
}

function Suppr({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-2 rounded-full text-muted hover:text-alerte hover:bg-alerte-doux shrink-0" aria-label="Supprimer">
      <Trash2 size={16} />
    </button>
  )
}

function ChoixPays({ pays, valeur, onChange }: { pays: string[]; valeur?: string; onChange: (v?: string) => void }) {
  return (
    <select value={valeur ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className={champ}>
      <option value="">Tous les pays</option>
      {pays.map((p) => (
        <option key={p} value={p}>
          {nomPays(p)}
        </option>
      ))}
    </select>
  )
}

export function EditeurNotes({
  notes,
  pays,
  partie,
  onChange,
}: {
  notes?: Notes
  pays: string[]
  partie: 'divers' | 'problemes' | 'commentaires'
  onChange: (n: Notes) => void
}) {
  const n = { ...VIDE, ...notes }
  const maj = (p: Partial<Notes>) => onChange({ ...n, ...p })

  if (partie === 'commentaires')
    return (
      <div className="rounded-2xl bg-carte border border-ligne p-5">
        <div className="font-semibold">Faits marquants par pays</div>
        <div className="text-sm text-ink-2 mt-1">Une ligne = un point. Les pays sans texte n'apparaissent pas sur la diapo.</div>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {pays.map((p) => (
            <label key={p} className="grid gap-1.5">
              <span className="text-sm font-medium">{nomPays(p)}</span>
              <textarea
                rows={3}
                className={`${champ} resize-y`}
                placeholder="ex. André est en arrêt maladie"
                defaultValue={n.commentaires?.[p] ?? ''}
                onBlur={(e) => {
                  if (e.target.value === (n.commentaires?.[p] ?? '')) return
                  maj({ commentaires: { ...(n.commentaires ?? {}), [p]: e.target.value } })
                }}
              />
            </label>
          ))}
        </div>
      </div>
    )

  if (partie === 'problemes')
    return (
      <div className="rounded-2xl bg-carte border border-ligne p-5">
        <div className="font-semibold">Problèmes récurrents</div>
        <div className="mt-4 grid gap-3">
          {n.problemes.map((p, i) => {
            const set = (c: Partial<typeof p>) => maj({ problemes: n.problemes.map((x, j) => (j === i ? { ...x, ...c } : x)) })
            return (
              <div key={p.id} className="grid sm:grid-cols-[2fr_1fr_110px_2fr_auto] gap-2 items-center">
                <input className={champ} placeholder="Problème (ex. DL en retard)" value={p.texte} onChange={(e) => set({ texte: e.target.value })} />
                <ChoixPays pays={pays} valeur={p.pays} onChange={(v) => set({ pays: v })} />
                <input className={champ} placeholder="Fréquence" value={p.occurrences ?? ''} onChange={(e) => set({ occurrences: e.target.value })} />
                <input className={champ} placeholder="Action engagée" value={p.action ?? ''} onChange={(e) => set({ action: e.target.value })} />
                <Suppr onClick={() => maj({ problemes: n.problemes.filter((_, j) => j !== i) })} />
              </div>
            )
          })}
          <div>
            <Ajouter texte="Ajouter un problème" onClick={() => maj({ problemes: [...n.problemes, { id: nouvelId(), texte: '' }] })} />
          </div>
        </div>
      </div>
    )

  return (
    <div className="rounded-2xl bg-carte border border-ligne p-5 grid gap-6">
      <div>
        <div className="font-semibold">Divers</div>
        <div className="mt-3 grid gap-2">
          {n.divers.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2">
              <input
                className={champ}
                placeholder="Point divers"
                value={d.texte}
                onChange={(e) => maj({ divers: n.divers.map((x, j) => (j === i ? { ...x, texte: e.target.value } : x)) })}
              />
              <Suppr onClick={() => maj({ divers: n.divers.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <div>
            <Ajouter texte="Ajouter un point divers" onClick={() => maj({ divers: [...n.divers, { id: nouvelId(), texte: '' }] })} />
          </div>
        </div>
      </div>
      <div>
        <div className="font-semibold">Axes d'amélioration</div>
        <div className="mt-3 grid gap-3">
          {n.axes.map((a, i) => {
            const set = (c: Partial<typeof a>) => maj({ axes: n.axes.map((x, j) => (j === i ? { ...x, ...c } : x)) })
            return (
              <div key={a.id} className="grid sm:grid-cols-[2fr_1fr_1fr_150px_auto] gap-2 items-center">
                <input className={champ} placeholder="Axe d'amélioration" value={a.texte} onChange={(e) => set({ texte: e.target.value })} />
                <ChoixPays pays={pays} valeur={a.pays} onChange={(v) => set({ pays: v })} />
                <input className={champ} placeholder="Responsable" value={a.responsable ?? ''} onChange={(e) => set({ responsable: e.target.value })} />
                <input className={champ} type="date" value={a.echeance ?? ''} onChange={(e) => set({ echeance: e.target.value || undefined })} />
                <Suppr onClick={() => maj({ axes: n.axes.filter((_, j) => j !== i) })} />
              </div>
            )
          })}
          <div>
            <Ajouter texte="Ajouter un axe" onClick={() => maj({ axes: [...n.axes, { id: nouvelId(), texte: '' }] })} />
          </div>
        </div>
      </div>
    </div>
  )
}

import { urlDrapeau } from '../components/BarresGroupees'
import type { Ctx } from './contexte'

export const AUTEUR_DEFAUT = 'Jean Didier N’GORAN'

// Étoiles à positions fixes (même rendu à chaque projection et à l'export)
const ETOILES = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 37.3) % 100,
  y: (i * 61.7 + 13) % 100,
  t: 1.5 + ((i * 7) % 5),
  d: (i * 0.37) % 3.2,
}))

/**
 * Diapo de fin : aurores en mouvement, drapeaux des pays en orbite lente autour du texte,
 * « Merci » qui apparaît lettre par lettre, une signature qui se dessine, puis le nom de l'auteur.
 * À l'export, les animations sont figées sur leur état final (classe .anim-figee).
 */
export function DiapoFin({ ctx }: { ctx: Ctx }) {
  const auteur = ctx.pres.auteur?.trim() || AUTEUR_DEFAUT
  const pays = ctx.pres.pays
  const mensuel = ctx.pres.type === 'mensuel'
  const c1 = mensuel ? '#6250d6' : '#2a78d6'
  const c2 = mensuel ? '#b4a9f1' : '#86b6ef'
  const lettres = 'Merci'.split('')
  const rx = 640
  const ry = 330

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: mensuel ? '#140f26' : '#07111f' }}>
      {/* aurores */}
      <div className="fin-aurore absolute rounded-full" style={{ width: 900, height: 900, left: -260, top: -380, background: `radial-gradient(circle, ${c1}66, transparent 65%)`, filter: 'blur(40px)' }} />
      <div className="fin-aurore absolute rounded-full" style={{ width: 800, height: 800, right: -240, bottom: -380, background: `radial-gradient(circle, ${c2}55, transparent 65%)`, filter: 'blur(40px)', animationDelay: '-7s' }} />
      <div className="fin-aurore absolute rounded-full" style={{ width: 600, height: 600, left: 520, top: 420, background: 'radial-gradient(circle, #0ca30c33, transparent 65%)', filter: 'blur(50px)', animationDelay: '-12s' }} />

      {/* étoiles */}
      {ETOILES.map((e, i) => (
        <span
          key={i}
          className="fin-etoile absolute rounded-full bg-white"
          style={{ left: `${e.x}%`, top: `${e.y}%`, width: i % 7 === 0 ? 4 : 2, height: i % 7 === 0 ? 4 : 2, animationDuration: `${e.t}s`, animationDelay: `${e.d}s` }}
        />
      ))}

      {/* orbite des pays présentés */}
      <svg className="absolute inset-0" width={1600} height={900} viewBox="0 0 1600 900" aria-hidden>
        <ellipse cx={800} cy={450} rx={rx} ry={ry} fill="none" stroke="white" strokeOpacity={0.08} strokeWidth={1.5} strokeDasharray="2 10" />
        <ellipse className="fin-halo" cx={800} cy={450} rx={rx - 70} ry={ry - 50} fill="none" stroke={c2} strokeOpacity={0.12} strokeWidth={1} />
      </svg>
      <div className="fin-orbite absolute" style={{ left: 800, top: 450, width: 0, height: 0 }}>
        {pays.map((p, i) => {
          const a = (i / pays.length) * Math.PI * 2 - Math.PI / 2
          const x = Math.cos(a) * rx
          const y = Math.sin(a) * ry
          const url = urlDrapeau(p)
          return (
            <div key={p} className="absolute" style={{ left: x - 26, top: y - 20 }}>
              <div className="fin-contre rounded-md overflow-hidden" style={{ width: 52, height: 39, boxShadow: `0 0 0 3px rgba(255,255,255,.15), 0 0 30px ${c1}` }}>
                {url && <img src={url} alt="" width={52} height={39} style={{ display: 'block', width: 52, height: 39, objectFit: 'cover' }} />}
              </div>
            </div>
          )
        })}
      </div>

      {/* texte */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center" style={{ perspective: 800 }}>
        <div className="text-[170px] leading-[0.95] font-bold tracking-[-0.04em]">
          {lettres.map((l, i) => (
            <span key={i} className="fin-lettre" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
              {l}
            </span>
          ))}
        </div>
        <div className="fin-monte mt-2 text-[46px] font-light text-white/85" style={{ animationDelay: '0.95s' }}>
          pour votre attention
        </div>

        <svg width={520} height={40} viewBox="0 0 520 40" className="mt-6" aria-hidden>
          <path
            className="fin-trait"
            d="M10 28 C 90 6, 150 36, 230 18 S 380 4, 430 22 S 500 30, 510 14"
            fill="none"
            stroke={c2}
            strokeWidth={3}
            strokeLinecap="round"
            style={{ animationDelay: '1.5s' }}
          />
        </svg>

        <div className="fin-monte mt-6 text-[32px] text-white/80" style={{ animationDelay: '2.4s' }}>
          Je suis disponible pour vos questions
        </div>
        <div className="fin-monte mt-10 text-[22px] uppercase tracking-[0.3em] text-white/50" style={{ animationDelay: '3.2s' }}>
          By
        </div>
        <div className="fin-monte mt-1 text-[40px] font-semibold tracking-[0.02em]" style={{ animationDelay: '3.5s', color: c2 }}>
          {auteur}
        </div>
      </div>
    </div>
  )
}

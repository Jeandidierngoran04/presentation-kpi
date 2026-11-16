import { useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ClipboardCopy, Database, ExternalLink, Loader2, Plug, RefreshCw, Unplug, XCircle } from 'lucide-react'
import codeScript from '../../apps-script/Code.gs?raw'
import { Drapeau } from '../components/Drapeau'
import { mois, numeroSemaine } from '../lib/format'
import { actualiser, enregistrerConfig, lireConfig, useDonnees } from '../lib/source'
import { DATE_COPIE } from '../lib/copieDonnee'

const URL_SHEET = 'https://docs.google.com/spreadsheets/d/10gSCZqAXaXX31clFx9AFSqn_FeaArFxOJtRGwlV7-90/edit'

function Etape({ n, titre, children }: { n: number; titre: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-nuit text-white text-sm font-semibold">{n}</span>
      <div className="min-w-0 pt-1">
        <div className="font-semibold">{titre}</div>
        <div className="mt-1 text-ink-2 text-[15px] leading-relaxed">{children}</div>
      </div>
    </li>
  )
}

const Menu = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block rounded-md bg-page border border-ligne px-1.5 py-0.5 text-[13px] font-medium text-ink whitespace-nowrap">{children}</span>
)

export function PageSource() {
  const d = useDonnees()
  const conf = lireConfig()
  const [url, setUrl] = useState(conf?.url ?? '')
  const [cle, setCle] = useState(conf?.cle ?? '')
  const [copie, setCopie] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  const semaines = [...new Set(d.lignes.filter((l) => l.type === 'semaine').map((l) => l.periode))].sort()
  const moisDispo = [...new Set(d.lignes.filter((l) => l.type === 'mois').map((l) => l.periode))].sort()
  const pays = [...new Set(d.lignes.map((l) => l.pays))]

  const connecter = async () => {
    setEnvoi(true)
    await enregistrerConfig({ url, cle })
    setEnvoi(false)
  }
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(codeScript)
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      alert('Copie impossible : ouvre le fichier apps-script/Code.gs et copie son contenu.')
    }
  }

  const champ = 'w-full rounded-xl border border-ligne bg-page px-4 py-3 outline-none focus:border-bleu-450 focus:bg-white'

  return (
    <div className="mx-auto max-w-[960px] px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Données</h1>
      <p className="mt-2 text-ink-2">Connexion au Google Sheet « Data KPI West Africa ».</p>

      {/* État */}
      <section className="mt-8 rounded-3xl bg-carte border border-ligne p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={`grid place-items-center w-12 h-12 rounded-2xl ${
              d.mode === 'demo' ? 'bg-vigilance-doux text-vigilance-texte' : d.statut === 'erreur' ? 'bg-alerte-doux text-alerte-texte' : 'bg-bon-doux text-bon-texte'
            }`}
          >
            {d.mode === 'demo' ? <Database size={22} /> : d.statut === 'erreur' ? <XCircle size={22} /> : d.statut === 'chargement' ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle2 size={22} />}
          </span>
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold text-lg">
              {d.mode === 'demo' ? `Copie de la feuille « Donnée » du ${DATE_COPIE}` : d.statut === 'erreur' ? 'Connexion en échec' : d.statut === 'chargement' ? 'Lecture du Google Sheet…' : `Connecté à « ${d.fichier} »`}
            </div>
            <div className="text-sm text-ink-2">
              {d.mode === 'demo'
                ? 'Les présentations fonctionnent déjà avec ces chiffres. Connecte le Sheet ci-dessous pour les avoir en direct.'
                : d.luLe
                  ? `Dernière lecture à ${new Date(d.luLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · relecture automatique toutes les 5 minutes`
                  : d.statut === 'erreur'
                    ? 'Aucune lecture réussie pour l’instant'
                    : 'Première lecture en cours'}
            </div>
          </div>
          {(d.mode === 'sheet' || d.ancienScript) && (
            <button onClick={() => actualiser()} className="inline-flex items-center gap-2 rounded-full border border-ligne px-4 py-2 text-sm font-medium hover:border-base">
              <RefreshCw size={15} className={d.statut === 'chargement' ? 'animate-spin' : ''} /> Relire maintenant
            </button>
          )}
        </div>
        {d.ancienScript && (
          <div className="mt-4 rounded-2xl bg-vigilance-doux text-vigilance-texte px-4 py-3 text-sm font-medium">
            Le Sheet répond, mais c'est encore l'ancien script qui est publié : il ne lit pas ta feuille « Donnée ». En attendant, l'application utilise la copie du {DATE_COPIE}. Recolle le script (bouton « Copier le script » plus bas), puis dans Apps Script :
            Déployer → Gérer les déploiements → crayon → Version « Nouvelle version » → Déployer.
          </div>
        )}
        {d.statut === 'erreur' && <div className="mt-4 rounded-2xl bg-alerte-doux text-alerte-texte px-4 py-3 text-sm font-medium">{d.erreur}</div>}

        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-page px-4 py-3">
            <div className="text-sm text-muted">Chiffres lus</div>
            <div className="chiffres text-2xl font-semibold">{d.lignes.length}</div>
          </div>
          <div className="rounded-2xl bg-page px-4 py-3">
            <div className="text-sm text-muted">Semaines</div>
            <div className="chiffres text-[15px] font-semibold mt-1">{semaines.length ? semaines.map((s) => `S${numeroSemaine(s)}`).join(' · ') : '—'}</div>
          </div>
          <div className="rounded-2xl bg-page px-4 py-3">
            <div className="text-sm text-muted">Mois</div>
            <div className="text-[15px] font-semibold mt-1">{moisDispo.length ? moisDispo.map(mois).join(' · ') : '—'}</div>
          </div>
        </div>
        {pays.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pays.map((p) => (
              <span key={p} className="inline-flex items-center rounded-full bg-page px-2.5 py-1">
                <Drapeau code={p} taille={16} />
              </span>
            ))}
          </div>
        )}
        {d.rejets.length > 0 && (
          <details className="mt-5 rounded-2xl bg-vigilance-doux px-4 py-3">
            <summary className="cursor-pointer font-medium text-vigilance-texte flex items-center gap-2">
              <AlertTriangle size={16} /> {d.rejets.length} ligne(s) ignorée(s) dans l'onglet « Données app »
            </summary>
            <ul className="mt-3 grid gap-1.5 text-sm">
              {d.rejets.slice(0, 30).map((r, i) => (
                <li key={i} className="text-ink-2">
                  <span className="font-semibold text-ink">{r.ligne ? `Ligne ${r.ligne} : ` : ''}</span>
                  {r.raison} <span className="text-muted">({r.texte})</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Connexion */}
      <section className="mt-6 rounded-3xl bg-carte border border-ligne p-6">
        <h2 className="text-lg font-semibold">Connexion</h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-ink-2">URL de l'application Web (se termine par /exec)</span>
            <input className={champ} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-ink-2">Clé de connexion</span>
            <input className={`${champ} font-mono`} value={cle} onChange={(e) => setCle(e.target.value)} placeholder="Affichée par le menu Présentation KPI" />
          </label>
          <div className="flex flex-wrap gap-2 mt-1">
            <button
              disabled={!url.trim() || !cle.trim() || envoi}
              onClick={connecter}
              className="inline-flex items-center gap-2 rounded-full bg-bleu-450 hover:bg-bleu-550 disabled:opacity-40 text-white font-semibold px-5 py-2.5"
            >
              {envoi ? <Loader2 size={17} className="animate-spin" /> : <Plug size={17} />} Tester et connecter
            </button>
            {conf && (
              <button
                onClick={() => {
                  if (confirm('Revenir aux données de démonstration ?')) {
                    setUrl('')
                    setCle('')
                    enregistrerConfig(null)
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-ligne px-4 py-2.5 text-sm font-medium hover:border-base"
              >
                <Unplug size={16} /> Déconnecter
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Guide */}
      <section className="mt-6 rounded-3xl bg-carte border border-ligne p-6">
        <h2 className="text-lg font-semibold">Installation (une seule fois, 10 minutes)</h2>
        <ol className="mt-5 grid gap-6">
          <Etape n={1} titre="Copier le script">
            <button onClick={copier} className="mt-1 inline-flex items-center gap-2 rounded-full bg-nuit text-white px-4 py-2 text-sm font-medium">
              {copie ? <Check size={16} /> : <ClipboardCopy size={16} />} {copie ? 'Script copié' : 'Copier le script'}
            </button>
          </Etape>
          <Etape n={2} titre="Le coller dans le Google Sheet">
            Ouvre{' '}
            <a href={URL_SHEET} target="_blank" rel="noreferrer" className="text-bleu-450 font-medium inline-flex items-center gap-1">
              le Sheet <ExternalLink size={13} />
            </a>
            , puis <Menu>Extensions</Menu> → <Menu>Apps Script</Menu>. Efface le contenu, colle le script, puis clique sur l'icône Enregistrer.
          </Etape>
          <Etape n={3} titre="Publier la nouvelle version">
            Dans Apps Script : <Menu>Déployer</Menu> → <Menu>Gérer les déploiements</Menu> → crayon → Version <Menu>Nouvelle version</Menu> → <Menu>Déployer</Menu>.
            L'URL ne change pas. (Tout premier déploiement : <Menu>Nouveau déploiement</Menu> → <Menu>Application Web</Menu>, exécuter en tant que <Menu>Moi</Menu>,
            accès <Menu>Tout le monde</Menu>.)
          </Etape>
          <Etape n={4} titre="Connecter">
            Colle l'URL ci-dessus. La clé s'affiche dans le Sheet avec <Menu>Présentation KPI</Menu> → <Menu>Afficher la clé de connexion</Menu> (recharge le Sheet si le menu
            n'apparaît pas). Clique sur « Tester et connecter ».
          </Etape>
          <Etape n={5} titre="C'est tout">
            L'application lit ta feuille « Donnée » en direct, toutes les 5 minutes. Continue tes imports comme d'habitude, il n'y a rien à saisir. L'onglet « Données app »
            ne sert plus : tu peux le supprimer.
          </Etape>
        </ol>
      </section>
    </div>
  )
}

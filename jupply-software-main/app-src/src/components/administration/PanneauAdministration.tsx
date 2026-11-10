import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  ChevronLeft,
  ImageUp,
  LayoutGrid,
  PanelLeft,
  Palette,
  Redo2,
  Table2,
  Trash2,
  Type,
  Undo2,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useApparence } from '../../context/ApparenceContext'
import { useSaisieEnCours } from '../../context/TabsContext'
import { useConfirmation } from '../../context/ConfirmationContext'
import { useToast } from '../../context/ToastContext'
import { messageErreur } from '../../lib/erreurs'
import { DEFAUTS, PALETTES, POLICES, lireLogo, poidsKo, valeur, type Apparence } from '../../lib/apparence'
import { BoutonVisuel, CLASSE_CHAMP_SOMBRE, ChampNombre, Choix, Ligne, Pastille, Section } from './Controles'

interface Brouillon {
  nom: string
  apparence: Apparence
}

type Rubrique = 'acces' | 'logo' | 'couleurs' | 'typographie' | 'barre' | 'tableaux' | 'mise-en-page'

// Chaque rubrique a sa couleur d'icône, comme un lanceur d'applications.
const RUBRIQUES: { id: Rubrique; label: string; icone: LucideIcon; couleur: string; bientot?: boolean }[] = [
  { id: 'acces', label: 'Accès', icone: UsersRound, couleur: 'text-sky-400', bientot: true },
  { id: 'logo', label: 'Logo', icone: ImageUp, couleur: 'text-emerald-400' },
  { id: 'couleurs', label: 'Couleurs', icone: Palette, couleur: 'text-fuchsia-400' },
  { id: 'typographie', label: 'Typographie', icone: Type, couleur: 'text-amber-400' },
  { id: 'barre', label: 'Barre latérale', icone: PanelLeft, couleur: 'text-indigo-400' },
  { id: 'tableaux', label: 'Tableaux', icone: Table2, couleur: 'text-teal-400' },
  { id: 'mise-en-page', label: 'Mise en page', icone: LayoutGrid, couleur: 'text-rose-400' },
]

const COULEURS_PALETTE: { cle: 'couleurPrincipale' | 'couleurSecondaire' | 'couleurFond' | 'couleurCartes' | 'couleurTexte'; titre: string }[] = [
  { cle: 'couleurPrincipale', titre: 'Principale' },
  { cle: 'couleurSecondaire', titre: 'Secondaire' },
  { cle: 'couleurFond', titre: 'Fond' },
  { cle: 'couleurCartes', titre: 'Cartes' },
  { cle: 'couleurTexte', titre: 'Texte' },
]

const egal = (a: Brouillon, b: Brouillon) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Panneau Administration, à droite de l'écran (Paramètre > Administration).
 * L'application à gauche sert d'aperçu : elle change en direct. Accueil en
 * tuiles (Accès, Logo, Couleurs...), un clic ouvre les réglages de la
 * rubrique. « Sauver » enregistre pour toute l'entreprise et referme ;
 * « Ignorer » ou un clic à côté referme (avec confirmation si rien n'est sauvé).
 */
export function PanneauAdministration() {
  const { panneauOuvert, fermerPanneau, enregistree, chargee, definirApercu, enregistrer } = useApparence()
  const { confirmer } = useConfirmation()
  const { afficherToast } = useToast()

  const [historique, setHistorique] = useState<Brouillon[]>([enregistree])
  const [position, setPosition] = useState(0)
  const brouillon = historique[position]
  const [rubrique, setRubrique] = useState<Rubrique | null>(null)
  const [palettesOuvertes, setPalettesOuvertes] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreurLogo, setErreurLogo] = useState<string | null>(null)
  const fichierRef = useRef<HTMLInputElement>(null)
  const panneauRef = useRef<HTMLElement>(null)
  /** Une confirmation est affichée : les clics dans sa fenêtre ne ferment pas le panneau. */
  const enConfirmation = useRef(false)

  const modifie = panneauOuvert && !egal(brouillon, enregistree)
  useSaisieEnCours('administration', modifie)

  // À chaque ouverture (et dès que l'apparence enregistrée est lue), on repart de l'enregistrée.
  useEffect(() => {
    if (!panneauOuvert) return
    setHistorique([enregistree])
    setPosition(0)
    setRubrique(null)
    setErreurLogo(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panneauOuvert, chargee])

  // Aperçu en direct sur toute l'application.
  useEffect(() => {
    if (panneauOuvert) definirApercu(modifie ? brouillon : null)
  }, [panneauOuvert, modifie, brouillon, definirApercu])

  async function demanderFermeture() {
    if (!modifie) return fermerPanneau()
    enConfirmation.current = true
    const ok = await confirmer({
      titre: 'Ignorer les modifications ?',
      message: 'Les réglages faits depuis le dernier enregistrement seront perdus.',
      libelleConfirmer: 'Ignorer',
      danger: true,
    })
    enConfirmation.current = false
    if (ok) fermerPanneau()
  }

  // Clic à côté du panneau (ou Échap) : il se referme.
  useEffect(() => {
    if (!panneauOuvert) return
    function onClic(e: MouseEvent) {
      const cible = e.target as HTMLElement
      if (enConfirmation.current || panneauRef.current?.contains(cible) || cible.closest('[data-ouvre-admin]')) return
      demanderFermeture()
    }
    function onTouche(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enConfirmation.current) demanderFermeture()
    }
    document.addEventListener('mousedown', onClic)
    window.addEventListener('keydown', onTouche)
    return () => {
      document.removeEventListener('mousedown', onClic)
      window.removeEventListener('keydown', onTouche)
    }
  })

  if (!panneauOuvert) return null

  function appliquer(suivant: Brouillon) {
    setHistorique((h) => [...h.slice(0, position + 1), suivant].slice(-100))
    setPosition((p) => Math.min(p + 1, 99))
  }
  const maj = (champs: Partial<Apparence>) => appliquer({ ...brouillon, apparence: { ...brouillon.apparence, ...champs } })
  const v = <K extends keyof Apparence>(cle: K) => valeur(brouillon.apparence, cle)

  async function onSauver() {
    setEnvoi(true)
    try {
      await enregistrer(brouillon.nom, brouillon.apparence)
      afficherToast('Apparence enregistrée')
      fermerPanneau()
    } catch (e) {
      afficherToast(messageErreur(e), 'erreur')
    } finally {
      setEnvoi(false)
    }
  }

  async function onFichierLogo(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    try {
      const image = await lireLogo(fichier)
      setErreurLogo(null)
      maj({ logoImage: image, logoType: 'image', afficherLogo: true })
    } catch (err) {
      setErreurLogo(messageErreur(err))
    }
  }

  const reglagesCharte = () =>
    maj(
      Object.fromEntries(
        Object.keys(DEFAUTS)
          .filter((k) => !['logoType', 'logoImage', 'logoHauteur', 'logoHauteurReduite', 'afficherLogo', 'afficherNom'].includes(k))
          .map((k) => [k, undefined]),
      ),
    )

  const optionsPolices = POLICES.map((p) => ({ valeur: p, label: p }))
  const titreRubrique = RUBRIQUES.find((r) => r.id === rubrique)?.label

  return (
    <aside
      ref={panneauRef}
      className={`animate-[panneau-entree_180ms_ease-out] ${rubrique ? 'w-[300px]' : 'w-[170px]'} transition-[width] duration-150 shrink-0 h-full flex flex-col bg-[#1d1d22] text-zinc-200 border-l border-black/50 shadow-[-8px_0_24px_rgba(0,0,0,.18)]`}
      aria-label="Administration"
    >
      {/* Annuler / rétablir, Ignorer, Sauver */}
      <div className="shrink-0 h-12 flex items-center gap-1 px-2 bg-[#141418]">
        {/* Barre étroite (tuiles) : pas la place pour annuler / rétablir, ils reviennent dans une rubrique. */}
        {rubrique && (
          <>
        <button
          type="button"
          onClick={() => setPosition((p) => Math.max(0, p - 1))}
          disabled={position === 0}
          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-zinc-300 hover:bg-white/10 disabled:opacity-30"
          title="Annuler"
        >
          <Undo2 size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setPosition((p) => Math.min(historique.length - 1, p + 1))}
          disabled={position >= historique.length - 1}
          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-zinc-300 hover:bg-white/10 disabled:opacity-30"
          title="Rétablir"
        >
          <Redo2 size={16} strokeWidth={1.75} />
        </button>
          </>
        )}
        <div className="flex-1" />
        {modifie ? (
          <>
            <button
              type="button"
              onClick={demanderFermeture}
              disabled={envoi}
              className="h-8 px-2 rounded-md text-[12.5px] text-zinc-300 hover:bg-white/10 disabled:opacity-40"
            >
              Ignorer
            </button>
            <button
              type="button"
              onClick={onSauver}
              disabled={envoi}
              className="h-8 px-3 rounded-md bg-emerald-400 text-[12.5px] font-semibold text-zinc-900 hover:bg-emerald-300 disabled:opacity-40"
            >
              {envoi ? 'Enregistrement...' : 'Sauver'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={fermerPanneau}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-zinc-300 hover:bg-white/10"
            title="Fermer"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Titre : Administration, ou la rubrique ouverte avec un retour */}
      <div className="shrink-0 h-11 flex items-center gap-1.5 px-2 border-b border-black/50 bg-[#141418]">
        {rubrique ? (
          <>
            <button
              type="button"
              onClick={() => {
                setRubrique(null)
                setPalettesOuvertes(false)
              }}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-zinc-300 hover:bg-white/10"
              title="Retour"
            >
              <ChevronLeft size={17} strokeWidth={1.9} />
            </button>
            <span className="text-[14px] font-semibold text-white">{titreRubrique}</span>
          </>
        ) : (
          <span className="pl-2 text-[14px] font-semibold text-white">Administration</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto defilement-fin">
        {/* Accueil : les tuiles */}
        {!rubrique && (
          <div className="grid grid-cols-2 gap-0.5 px-1.5 py-2">
            {RUBRIQUES.map((r) => {
              const Icone = r.icone
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={r.bientot}
                  onClick={() => setRubrique(r.id)}
                  title={r.bientot ? `${r.label} : bientôt` : r.label}
                  className="relative h-[66px] rounded-md flex flex-col items-center justify-center gap-1.5 px-1 hover:bg-white/[0.07] transition-colors disabled:opacity-45 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <Icone size={22} strokeWidth={1.6} className={r.couleur} />
                  <span className="max-w-full truncate text-[11px] text-zinc-200">{r.label}</span>
                  {r.bientot && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-zinc-400" />}
                </button>
              )
            })}
          </div>
        )}

        {rubrique === 'logo' && (
          <>
            <Section titre="Entreprise">
              <Ligne label="Nom">
                <input value={brouillon.nom} onChange={(e) => appliquer({ ...brouillon, nom: e.target.value })} className={`${CLASSE_CHAMP_SOMBRE} w-full`} />
              </Ligne>
            </Section>

            <Section titre="Image" badge={brouillon.apparence.logoImage ? `${poidsKo(brouillon.apparence.logoImage)} kB` : undefined}>
              {brouillon.apparence.logoImage && (
                <div className="h-20 rounded-md border border-white/10 flex items-center justify-center bg-[repeating-conic-gradient(#2c2c33_0_25%,#24242a_0_50%)] bg-[length:16px_16px]">
                  <img src={brouillon.apparence.logoImage} alt="Logo" className="max-h-16 max-w-[90%] object-contain" />
                </div>
              )}
              <Ligne label="Média">
                <button
                  type="button"
                  onClick={() => fichierRef.current?.click()}
                  className="flex-1 h-[30px] rounded-md bg-emerald-400 text-[12.5px] font-semibold text-zinc-900 hover:bg-emerald-300 inline-flex items-center justify-center gap-1.5"
                >
                  <ImageUp size={14} strokeWidth={2} /> {brouillon.apparence.logoImage ? 'Remplacer' : 'Ajouter'}
                </button>
                {brouillon.apparence.logoImage && (
                  <button
                    type="button"
                    onClick={() => maj({ logoImage: null, logoType: 'initiale' })}
                    className="w-[30px] h-[30px] rounded-md bg-[#2c2c33] border border-white/10 text-zinc-300 hover:text-red-400 inline-flex items-center justify-center"
                    title="Retirer le logo"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                )}
              </Ligne>
              {erreurLogo && <p className="text-[12px] text-red-400">{erreurLogo}</p>}
              <input ref={fichierRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onFichierLogo} className="hidden" />
            </Section>

            <Section titre="Logo dans la barre">
              <Ligne label="Logo">
                <Choix
                  valeur={v('logoType')}
                  options={[
                    { valeur: 'image', label: 'Image' },
                    { valeur: 'initiale', label: 'Initiale' },
                  ]}
                  onChange={(t) => (t === 'image' && !brouillon.apparence.logoImage ? fichierRef.current?.click() : maj({ logoType: t }))}
                />
              </Ligne>
              {v('logoType') === 'image' && (
                <>
                  <Ligne label="Hauteur" retrait>
                    <ChampNombre valeur={v('logoHauteur')} min={16} max={48} onChange={(n) => maj({ logoHauteur: n })} />
                  </Ligne>
                  <Ligne label="Hauteur (réduite)" retrait>
                    <ChampNombre valeur={v('logoHauteurReduite')} min={16} max={40} onChange={(n) => maj({ logoHauteurReduite: n })} />
                  </Ligne>
                </>
              )}
              <Ligne label="Visuels">
                <BoutonVisuel actif={v('afficherLogo')} onClick={() => maj({ afficherLogo: !v('afficherLogo') })} titre="Logo">
                  LOGO
                </BoutonVisuel>
                <BoutonVisuel actif={v('afficherNom')} onClick={() => maj({ afficherNom: !v('afficherNom') })} titre="Nom de l'entreprise">
                  <Type size={15} strokeWidth={2} />
                </BoutonVisuel>
              </Ligne>
            </Section>
          </>
        )}

        {rubrique === 'couleurs' && (
          <>
            <Section titre="Couleurs">
              <div className="h-8 flex rounded-md overflow-hidden border border-white/20">
                {COULEURS_PALETTE.map(({ cle, titre }) => (
                  <label key={cle} className="relative flex-1 cursor-pointer" style={{ background: v(cle) }} title={titre}>
                    <input type="color" value={v(cle)} onChange={(e) => maj({ [cle]: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1 text-center text-[10.5px] text-zinc-500">
                {COULEURS_PALETTE.map(({ cle, titre }) => (
                  <span key={cle}>{titre}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPalettesOuvertes((o) => !o)}
                className="h-[30px] rounded-md bg-lime-300 text-[12.5px] font-semibold text-zinc-900 hover:bg-lime-200"
              >
                Changer de palette
              </button>
              {palettesOuvertes && (
                <div className="grid grid-cols-2 gap-2">
                  {PALETTES.map((p) => (
                    <button
                      key={p.nom}
                      type="button"
                      onClick={() => maj(p.couleurs)}
                      className="rounded-md border border-white/10 bg-[#2c2c33] p-1.5 text-left hover:border-emerald-400/60"
                    >
                      <span className="flex h-5 rounded overflow-hidden">
                        {Object.values(p.couleurs).map((c, i) => (
                          <span key={i} className="flex-1" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="block mt-1 text-[11.5px] text-zinc-300">{p.nom}</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
            <div className="p-3">
              <button type="button" onClick={reglagesCharte} className="w-full h-8 rounded-md border border-white/15 text-[12.5px] text-zinc-300 hover:bg-white/5">
                Revenir à la charte Jupply
              </button>
            </div>
          </>
        )}

        {rubrique === 'typographie' && (
          <>
            <Section titre="Titres">
              <Ligne label="Taille caractères">
                <ChampNombre valeur={v('titreTaille')} min={14} max={32} onChange={(n) => maj({ titreTaille: n })} />
              </Ligne>
              <Ligne label="Police">
                <Choix valeur={v('titrePolice')} options={optionsPolices} onChange={(p) => maj({ titrePolice: p })} />
              </Ligne>
              <Ligne label="Graisse">
                <Choix<number>
                  valeur={brouillon.apparence.titreGraisse ?? 0}
                  options={[
                    { valeur: 0, label: 'Automatique' },
                    { valeur: 400, label: 'Normale' },
                    { valeur: 500, label: 'Moyenne' },
                    { valeur: 600, label: 'Semi-grasse' },
                    { valeur: 700, label: 'Grasse' },
                  ]}
                  onChange={(g) => maj({ titreGraisse: g || null })}
                />
              </Ligne>
            </Section>
            <Section titre="Texte">
              <Ligne label="Police">
                <Choix valeur={v('textePolice')} options={optionsPolices} onChange={(p) => maj({ textePolice: p })} />
              </Ligne>
            </Section>
          </>
        )}

        {rubrique === 'barre' && (
          <Section titre="Barre latérale">
            <Ligne label="Arrière-plan">
              <Pastille couleur={v('navFond')} onChange={(c) => maj({ navFond: c })} titre="Arrière-plan" />
            </Ligne>
            <Ligne label="Survol">
              <Pastille couleur={v('navSurvol')} onChange={(c) => maj({ navSurvol: c })} titre="Survol" />
            </Ligne>
            <Ligne label="Élément actif">
              <Pastille couleur={v('navActif')} onChange={(c) => maj({ navActif: c })} titre="Élément actif" />
            </Ligne>
            <Ligne label="Largeur">
              <ChampNombre valeur={v('navLargeur')} min={200} max={320} onChange={(n) => maj({ navLargeur: n })} />
            </Ligne>
            <Ligne label="Taille du texte">
              <ChampNombre valeur={v('navTaille')} min={11} max={17} pas={0.5} onChange={(n) => maj({ navTaille: n })} />
            </Ligne>
            <Ligne label="Hauteur des lignes">
              <ChampNombre valeur={v('navHauteurLigne')} min={28} max={44} onChange={(n) => maj({ navHauteurLigne: n })} />
            </Ligne>
          </Section>
        )}

        {rubrique === 'tableaux' && (
          <Section titre="Tableaux">
            <Ligne label="Taille caractères">
              <ChampNombre valeur={v('tableTaille')} min={11} max={16} pas={0.5} onChange={(n) => maj({ tableTaille: n })} />
            </Ligne>
            <Ligne label="Taille en-têtes">
              <ChampNombre valeur={v('tableEnteteTaille')} min={10} max={14} pas={0.5} onChange={(n) => maj({ tableEnteteTaille: n })} />
            </Ligne>
            <Ligne label="Hauteur de ligne">
              <ChampNombre valeur={v('tableHauteurLigne')} min={28} max={48} onChange={(n) => maj({ tableHauteurLigne: n })} />
            </Ligne>
          </Section>
        )}

        {rubrique === 'mise-en-page' && (
          <Section titre="Mise en page">
            <Ligne label="Coins arrondis">
              <ChampNombre valeur={v('coins')} min={0} max={20} onChange={(n) => maj({ coins: n })} />
            </Ligne>
            <Ligne label="Marges">
              <ChampNombre valeur={v('margeContenu')} min={4} max={32} onChange={(n) => maj({ margeContenu: n })} />
            </Ligne>
          </Section>
        )}
      </div>
    </aside>
  )
}

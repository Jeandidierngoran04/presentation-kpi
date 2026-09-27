/** Filtre texte partagé : "commence par" par défaut, "*" en préfixe = "contient". */
export function texteFiltre(valeur: string, filtre: string): boolean {
  if (!filtre) return true
  const contient = filtre.startsWith('*')
  const terme = (contient ? filtre.slice(1) : filtre).trim().toLowerCase()
  if (!terme) return true
  const cible = valeur.toLowerCase()
  return contient ? cible.includes(terme) : cible.startsWith(terme)
}

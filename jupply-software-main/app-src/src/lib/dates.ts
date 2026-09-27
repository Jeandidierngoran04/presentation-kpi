/** Convertit une Date en valeur pour <input type="date"> (YYYY-MM-DD, en heure locale). */
export function dateVersInput(d: Date): string {
  const annee = d.getFullYear()
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

/**
 * Combine une date saisie (YYYY-MM-DD, "Date du mouvement" modifiable) avec
 * l'heure actuelle, et renvoie un ISO string UTC correct pour l'envoyer au
 * serveur (évite les décalages de fuseau horaire d'une simple concaténation).
 */
export function dateSaisieVersISO(dateSaisie: string): string {
  const [annee, mois, jour] = dateSaisie.split('-').map(Number)
  const maintenant = new Date()
  const combinee = new Date(
    annee,
    mois - 1,
    jour,
    maintenant.getHours(),
    maintenant.getMinutes(),
    maintenant.getSeconds(),
  )
  return combinee.toISOString()
}

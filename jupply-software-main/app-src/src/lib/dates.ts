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

/** Durée lisible entre deux instants (ex. « 3 j 4 h », « 5 h 12 min », « 8 min »). */
export function dureeLisible(millisecondes: number): string {
  const minutes = Math.max(0, Math.round(millisecondes / 60000))
  const jours = Math.floor(minutes / 1440)
  const heures = Math.floor((minutes % 1440) / 60)
  const reste = minutes % 60
  if (jours > 0) return heures > 0 ? `${jours} j ${heures} h` : `${jours} j`
  if (heures > 0) return reste > 0 ? `${heures} h ${reste} min` : `${heures} h`
  return `${reste} min`
}

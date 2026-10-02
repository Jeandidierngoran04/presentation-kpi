/**
 * Message lisible d'une erreur. Les erreurs Supabase sont des objets
 * `{ message, code, ... }` et non des `Error` JavaScript : un simple
 * `instanceof Error` les transformait en "Erreur inconnue".
 */
export function messageErreur(err: unknown): string {
  const message =
    typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : ''
  // Colonne ou fonction absente : la base n'a pas reçu la dernière migration.
  if (/schema cache|could not find the|does not exist/i.test(message)) {
    return `La base de données n'est pas à jour : exécute la dernière migration SQL dans Supabase. (${message})`
  }
  return message || 'Erreur inconnue.'
}

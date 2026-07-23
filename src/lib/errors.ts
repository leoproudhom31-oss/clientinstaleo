// Message d'accompagnement affiche sous une erreur, adapte a sa vraie cause.
// Ne JAMAIS supposer "Instagram bloque" par defaut : une panne reseau locale
// (code 'network') n'a rien a voir avec un rejet cote Instagram, et le
// message affiche doit rester exact.
export function errorHint(code?: string): string | null {
  switch (code) {
    case 'network':
      return 'Ta connexion internet semble indisponible ou instable. Reessaie dans un instant.'
    case 'expired':
    case 'ua_mismatch':
    case 'redirect_loop':
      return 'Ta session a expire ou n’est plus valide. Deconnecte-toi puis reconnecte-toi.'
    case 'checkpoint':
      return "Instagram demande une verification. Ouvre l'app officielle, confirme, puis reessaie."
    case 'no_session':
      return null // pas une erreur : simplement pas encore connecte
    default:
      return null
  }
}

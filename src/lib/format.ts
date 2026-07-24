// Formatage des dates facon Discord (en francais).

const MOIS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function heure(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "Aujourd'hui a 14:32", "Hier a 09:10", ou "12 mars 2024 14:32"
export function formatMessageTime(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yest.toDateString()

  if (sameDay) return `Aujourd'hui a ${heure(d)}`
  if (isYesterday) return `Hier a ${heure(d)}`
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} ${heure(d)}`
}

// Heure seule (survol des messages groupes)
export function formatShortTime(tsSeconds: number): string {
  return heure(new Date(tsSeconds * 1000))
}

// Separateur de jour dans une conversation : "Aujourd'hui", "Hier", ou la date.
export function formatDay(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui"
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Hier'
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`
}

// "il y a 3 min", "il y a 2 h", "il y a 4 j"
export function formatRelative(tsSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - tsSeconds
  if (diff < 60) return "a l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return `il y a ${Math.floor(diff / 86400)} j`
}

// Compteurs : 1 234 -> "1,2 k"
export function formatCount(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace('.', ',')} k`
  return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`
}

// Deux messages du meme auteur, proches dans le temps => groupes.
export function shouldGroup(prevTs: number, ts: number, sameAuthor: boolean): boolean {
  return sameAuthor && Math.abs(ts - prevTs) < 5 * 60
}

import type { SpaceId } from '../types'

export interface SpaceMeta {
  id: SpaceId
  label: string
  short: string // lettre pour l'icone du rail
  description: string
}

export const SPACES: SpaceMeta[] = [
  {
    id: 'feed',
    label: 'Fil d’actualite',
    short: 'F',
    description: 'Les dernieres publications de tes abonnements, sans pub ni tracker.',
  },
  {
    id: 'direct',
    label: 'Messages',
    short: 'M',
    description: 'Tes conversations privees Instagram.',
  },
  {
    id: 'explore',
    label: 'Explorer',
    short: 'E',
    description: 'Decouvrir de nouveaux comptes.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    short: 'N',
    description: 'Likes, commentaires et nouveaux abonnes.',
  },
  {
    id: 'profile',
    label: 'Profil',
    short: 'P',
    description: 'Ton compte et tes reglages.',
  },
]

export function spaceMeta(id: SpaceId): SpaceMeta {
  return SPACES.find((s) => s.id === id) ?? SPACES[0]
}

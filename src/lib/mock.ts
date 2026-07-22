// Donnees de demonstration — 100% locales, aucune connexion requise.
// Permet de voir l'interface immediatement (et sur Vercel sans identifiants).

import type { Message, Post, Thread, ThreadPreview, User } from '../types'
import { generateAvatar } from './avatars'

function mkUser(
  username: string,
  fullName: string,
  opts: Partial<User> = {},
): User {
  return {
    pk: `demo-${username}`,
    username,
    fullName,
    avatarUrl: generateAvatar(username, fullName),
    isVerified: opts.isVerified ?? false,
    isPrivate: opts.isPrivate ?? false,
  }
}

export const demoMe: User = mkUser('leo', 'Leo', { isVerified: false })

const alice = mkUser('alice.codes', 'Alice Martin', { isVerified: true })
const maxime = mkUser('maxime_ph', 'Maxime Photo')
const studio = mkUser('studio.nova', 'Studio Nova', { isVerified: true })
const nina = mkUser('nina.travels', 'Nina', { isPrivate: false })
const gamers = mkUser('pixel.arcade', 'Pixel Arcade')
const chef = mkUser('chef.leo', 'Chez Leo')

export const demoUsers: User[] = [alice, maxime, studio, nina, gamers, chef]

const now = Math.floor(Date.now() / 1000)

export const demoFeed: Post[] = [
  {
    id: 'p1',
    author: alice,
    takenAt: now - 60 * 22,
    caption:
      'Nouveau projet open-source en ligne 🚀 un client web minimaliste, zero tracker.\nRetours bienvenus en commentaire !',
    imageUrl: null,
    likeCount: 1284,
    commentCount: 47,
    location: 'Toulouse, France',
  },
  {
    id: 'p2',
    author: maxime,
    takenAt: now - 60 * 95,
    caption: 'Lumiere de fin de journee sur les toits 🌇 #photography',
    imageUrl: null,
    likeCount: 532,
    commentCount: 12,
    location: 'Lyon',
  },
  {
    id: 'p3',
    author: studio,
    takenAt: now - 60 * 60 * 5,
    caption:
      'Coulisses du dernier shooting. On adore ce degrade de couleurs 🎨',
    imageUrl: null,
    likeCount: 8921,
    commentCount: 203,
    location: null,
  },
  {
    id: 'p4',
    author: nina,
    takenAt: now - 60 * 60 * 9,
    caption: 'Petit weekend a la montagne pour couper des ecrans ⛰️',
    imageUrl: null,
    likeCount: 341,
    commentCount: 8,
    location: 'Chamonix',
  },
  {
    id: 'p5',
    author: chef,
    takenAt: now - 60 * 60 * 26,
    caption: 'Recette du dimanche : risotto aux champignons 🍄 Le secret ? La patience.',
    imageUrl: null,
    likeCount: 2765,
    commentCount: 91,
    location: null,
  },
]

function msg(
  id: string,
  senderId: string,
  text: string,
  minutesAgo: number,
  itemType: Message['itemType'] = 'text',
): Message {
  return { id, senderId, text, timestamp: now - minutesAgo * 60, itemType }
}

const threadAlice: Thread = {
  id: 't-alice',
  title: alice.fullName,
  users: [alice],
  isGroup: false,
  unread: true,
  lastActivity: now - 60 * 4,
  lastMessage: 'Tu as vu ma derniere PR ? 👀',
  messages: [
    msg('m1', alice.pk, 'Salut ! Ca avance le client Insta ?', 55),
    msg('m2', demoMe.pk, 'Ouais je suis en train de refaire l’UI facon Discord', 52),
    msg('m3', demoMe.pk, 'C’est carrement plus agreable a lire', 52),
    msg('m4', alice.pk, 'Genial, montre quand c’est pret !', 40),
    msg('m5', alice.pk, 'Au fait j’ai pousse une branche avec le proxy serverless', 8),
    msg('m6', alice.pk, 'Tu as vu ma derniere PR ? 👀', 4),
  ],
}

const threadStudio: Thread = {
  id: 't-studio',
  title: studio.fullName,
  users: [studio],
  isGroup: false,
  unread: false,
  lastActivity: now - 60 * 60 * 3,
  lastMessage: 'Merci pour le partage 🙏',
  messages: [
    msg('s1', studio.pk, 'Hello ! On adore ton approche sans tracker', 60 * 4),
    msg('s2', demoMe.pk, 'Merci beaucoup 🙏 c’est le but', 60 * 3.5),
    msg('s3', studio.pk, 'Merci pour le partage 🙏', 60 * 3),
  ],
}

const threadGroup: Thread = {
  id: 't-group',
  title: 'Team Projet',
  users: [alice, maxime, nina],
  isGroup: true,
  unread: true,
  lastActivity: now - 60 * 30,
  lastMessage: 'Maxime: on se cale un call demain ?',
  messages: [
    msg('g1', nina.pk, 'Salut la team 👋', 60 * 6),
    msg('g2', alice.pk, 'Yo !', 60 * 5.9),
    msg('g3', maxime.pk, 'On avance bien sur la maquette', 60 * 2),
    msg('g4', demoMe.pk, 'Top, je pousse le theme ce soir', 60),
    msg('g5', maxime.pk, 'on se cale un call demain ?', 30),
  ],
}

export const demoThreads: Thread[] = [threadAlice, threadGroup, threadStudio]

export function demoThreadPreviews(): ThreadPreview[] {
  return demoThreads.map((t) => ({
    id: t.id,
    title: t.title,
    users: t.users,
    lastMessage: t.lastMessage,
    lastActivity: t.lastActivity,
    unread: t.unread,
    isGroup: t.isGroup,
  }))
}

export function demoThreadById(id: string): Thread | undefined {
  return demoThreads.find((t) => t.id === id)
}

// Membres "en ligne / hors ligne" pour la colonne de droite (feed).
export const demoOnline: User[] = [alice, studio, maxime]
export const demoOffline: User[] = [nina, gamers, chef]

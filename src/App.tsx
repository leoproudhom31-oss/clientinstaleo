import type { ReactNode } from 'react'
import {
  AtSign,
  Bell,
  Compass,
  Hash,
  MessagesSquare,
  UserCircle,
} from 'lucide-react'
import { StoreProvider, useStore } from './state/store'
import { ServerRail } from './components/ServerRail'
import { ChannelSidebar } from './components/ChannelSidebar'
import { MemberList } from './components/MemberList'
import { FeedView } from './components/FeedView'
import { StoriesView } from './components/StoriesView'
import { ReelsView } from './components/ReelsView'
import { SavedView } from './components/SavedView'
import { DMView } from './components/DMView'
import { ProfileView } from './components/ProfileView'
import { EmptyState } from './components/EmptyState'
import { MainHeader } from './components/MainHeader'
import { LoginModal } from './components/LoginModal'
import { SettingsModal } from './components/SettingsModal'

const FEED_LABELS: Record<string, string> = {
  accueil: 'accueil',
  stories: 'stories',
  reels: 'reels',
  saved: 'enregistres',
}

interface HeaderConfig {
  icon: ReactNode
  title: string
  description?: string
  showMembersToggle?: boolean
}

function useHeaderConfig(): HeaderConfig {
  const { space, feedChannel, activeThread } = useStore()
  switch (space) {
    case 'feed': {
      const label = FEED_LABELS[feedChannel] ?? feedChannel
      const DESCRIPTIONS: Record<string, string> = {
        accueil: 'Le fil de tes abonnements',
        stories: 'Les stories de tes abonnements',
        reels: 'Les videos courtes de tes abonnements',
        saved: 'Tes publications enregistrees',
      }
      return {
        icon: <Hash size={22} />,
        title: label,
        description: DESCRIPTIONS[feedChannel] ?? 'Bientot disponible',
        showMembersToggle: feedChannel === 'accueil',
      }
    }
    case 'direct':
      return activeThread
        ? {
            icon: <AtSign size={22} />,
            title: activeThread.title,
            description: activeThread.isGroup
              ? `${activeThread.users.length + 1} membres`
              : 'Message prive',
            showMembersToggle: true,
          }
        : {
            icon: <MessagesSquare size={22} />,
            title: 'Messages',
            description: 'Choisis une conversation',
          }
    case 'profile':
      return { icon: <UserCircle size={22} />, title: 'profil' }
    case 'explore':
      return { icon: <Compass size={22} />, title: 'explorer' }
    case 'notifications':
      return { icon: <Bell size={22} />, title: 'notifications' }
  }
}

function Workspace() {
  const { space, feedChannel, membersVisible } = useStore()
  const header = useHeaderConfig()
  const showMembers =
    membersVisible &&
    ((space === 'feed' && feedChannel === 'accueil') || space === 'direct')

  return (
    <div className="main">
      <MainHeader
        icon={header.icon}
        title={header.title}
        description={header.description}
        showMembersToggle={header.showMembersToggle}
      />
      <div className="main-body">
        {space === 'feed' && feedChannel === 'stories' && <StoriesView />}
        {space === 'feed' && feedChannel === 'reels' && <ReelsView />}
        {space === 'feed' && feedChannel === 'saved' && <SavedView />}
        {space === 'feed' &&
          !['stories', 'reels', 'saved'].includes(feedChannel) && <FeedView />}
        {space === 'direct' && <DMView />}
        {space === 'profile' && <ProfileView />}
        {space === 'explore' && (
          <div className="content">
            <EmptyState icon={<Compass size={40} />} title="Explorer">
              La decouverte de nouveaux comptes arrivera dans une prochaine
              version. Le fil et les messages sont deja fonctionnels.
            </EmptyState>
          </div>
        )}
        {space === 'notifications' && (
          <div className="content">
            <EmptyState icon={<Bell size={40} />} title="Notifications">
              Tes j'aime, commentaires et abonnements s'afficheront ici.
            </EmptyState>
          </div>
        )}
        {showMembers && <MemberList />}
      </div>
    </div>
  )
}

function Shell() {
  return (
    <div className="app">
      <ServerRail />
      <ChannelSidebar />
      <Workspace />
      <LoginModal />
      <SettingsModal />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

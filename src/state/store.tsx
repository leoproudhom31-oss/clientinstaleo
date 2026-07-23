import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Message,
  Post,
  Reel,
  SpaceId,
  StoryItem,
  StoryTray,
  Thread,
  ThreadPreview,
  User,
} from '../types'
import { api, ApiError } from '../lib/api'
import {
  demoFeed,
  demoMe,
  demoReels,
  demoSaved,
  demoStories,
  demoThreadById,
  demoThreadPreviews,
} from '../lib/mock'

type Mode = 'demo' | 'live'

interface Store {
  mode: Mode
  me: User

  space: SpaceId
  setSpace: (s: SpaceId) => void

  feedChannel: string
  setFeedChannel: (c: string) => void

  feed: Post[]
  feedLoading: boolean
  feedLoadingMore: boolean
  refreshFeed: () => void
  loadMoreFeed: () => void

  stories: StoryTray[]
  storiesLoading: boolean
  refreshStories: () => void
  loadStoryItems: (reelId: string) => Promise<StoryItem[]>

  reels: Reel[]
  reelsLoading: boolean
  reelsLoadingMore: boolean
  loadMoreReels: () => void

  saved: Post[]
  savedLoading: boolean
  savedLoadingMore: boolean
  loadMoreSaved: () => void

  threads: ThreadPreview[]
  threadsLoading: boolean
  refreshInbox: () => void
  activeThreadId: string | null
  activeThread: Thread | null
  threadLoading: boolean
  olderLoading: boolean
  openThread: (id: string) => void
  loadOlderMessages: () => void
  sendMessage: (text: string) => void

  error: string | null
  errorCode: string | undefined

  membersVisible: boolean
  toggleMembers: () => void

  loginOpen: boolean
  setLoginOpen: (v: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void

  onLoggedIn: (user: User) => void
  logout: () => void
  switchToDemo: () => void
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit etre utilise dans <StoreProvider>')
  return ctx
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('demo')
  const [me, setMe] = useState<User>(demoMe)

  const [space, setSpace] = useState<SpaceId>('feed')
  const [feedChannel, setFeedChannel] = useState<string>('accueil')

  const [feed, setFeed] = useState<Post[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)
  const [feedHasMore, setFeedHasMore] = useState(false)
  const [feedNextMaxId, setFeedNextMaxId] = useState<string | null>(null)

  const [stories, setStories] = useState<StoryTray[]>([])
  const [storiesLoading, setStoriesLoading] = useState(false)

  const [reels, setReels] = useState<Reel[]>([])
  const [reelsLoading, setReelsLoading] = useState(false)
  const [reelsLoadingMore, setReelsLoadingMore] = useState(false)
  const [reelsHasMore, setReelsHasMore] = useState(false)
  const [reelsMaxId, setReelsMaxId] = useState<string | null>(null)

  const [saved, setSaved] = useState<Post[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedLoadingMore, setSavedLoadingMore] = useState(false)
  const [savedHasMore, setSavedHasMore] = useState(false)
  const [savedMaxId, setSavedMaxId] = useState<string | null>(null)

  const [threads, setThreads] = useState<ThreadPreview[]>([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined)
  const [membersVisible, setMembersVisible] = useState(true)
  const [loginOpen, setLoginOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const toggleMembers = useCallback(() => setMembersVisible((v) => !v), [])

  // Evite les courses : on ignore les reponses tardives d'un thread abandonne.
  const threadReq = useRef(0)
  const modeRef = useRef(mode)
  modeRef.current = mode

  // Buffer d'"avance" pour l'historique des DM : une page plus ancienne est
  // recuperee EN ARRIERE-PLAN des que possible (a l'ouverture du thread, puis
  // a nouveau apres chaque fusion), pour que le defilement vers le haut ne
  // montre jamais de temps de chargement, meme en scrollant vite.
  const olderBufferRef = useRef<{
    threadId: string
    messages: Message[]
    hasOlder: boolean
    oldestCursor: string | null
  } | null>(null)
  const olderFetchRef = useRef<Promise<void> | null>(null)

  // Meme principe de prefetch "d'avance" que pour l'historique des DM, mais
  // pour la suite du fil (defilement infini vers le bas).
  const feedBufferRef = useRef<{
    maxId: string
    posts: Post[]
    hasMore: boolean
    nextMaxId: string | null
  } | null>(null)
  const feedFetchRef = useRef<Promise<void> | null>(null)

  const loadFeed = useCallback(async (m: Mode) => {
    setFeedLoading(true)
    setError(null)
    setErrorCode(undefined)
    feedBufferRef.current = null
    try {
      if (m === 'demo') {
        setFeed(demoFeed)
        setFeedHasMore(false)
        setFeedNextMaxId(null)
      } else {
        const { posts, hasMore, nextMaxId } = await api.feed()
        setFeed(posts)
        setFeedHasMore(hasMore)
        setFeedNextMaxId(nextMaxId)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors du chargement du fil.')
      setErrorCode(e instanceof ApiError ? e.code : undefined)
      setFeed([])
      setFeedHasMore(false)
      setFeedNextMaxId(null)
    } finally {
      setFeedLoading(false)
    }
  }, [])

  const loadStories = useCallback(async (m: Mode) => {
    setStoriesLoading(true)
    setError(null)
    setErrorCode(undefined)
    try {
      if (m === 'demo') {
        setStories(demoStories())
      } else {
        const { trays } = await api.stories()
        setStories(trays)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors du chargement des stories.')
      setErrorCode(e instanceof ApiError ? e.code : undefined)
      setStories([])
    } finally {
      setStoriesLoading(false)
    }
  }, [])

  // Recupere a la demande les items d'une story (quand le carrousel ne les a
  // pas deja fournis) et les memorise dans la tuile correspondante.
  const loadStoryItems = useCallback(
    async (reelId: string): Promise<StoryItem[]> => {
      if (modeRef.current === 'demo') {
        return demoStories().find((t) => t.id === reelId)?.items ?? []
      }
      const { items } = await api.storyReel(reelId)
      setStories((prev) =>
        prev.map((t) => (t.id === reelId ? { ...t, items } : t)),
      )
      return items
    },
    [],
  )

  const loadReels = useCallback(async (m: Mode) => {
    setReelsLoading(true)
    setError(null)
    setErrorCode(undefined)
    try {
      if (m === 'demo') {
        setReels(demoReels())
        setReelsHasMore(false)
        setReelsMaxId(null)
      } else {
        const { reels: r, hasMore, nextMaxId } = await api.reels()
        setReels(r)
        setReelsHasMore(hasMore)
        setReelsMaxId(nextMaxId)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors du chargement des reels.')
      setErrorCode(e instanceof ApiError ? e.code : undefined)
      setReels([])
      setReelsHasMore(false)
      setReelsMaxId(null)
    } finally {
      setReelsLoading(false)
    }
  }, [])

  const loadMoreReels = useCallback(async () => {
    if (modeRef.current !== 'live' || !reelsHasMore || !reelsMaxId || reelsLoadingMore) return
    setReelsLoadingMore(true)
    try {
      const { reels: r, hasMore, nextMaxId } = await api.reels(reelsMaxId)
      setReels((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...r.filter((p) => !seen.has(p.id))]
      })
      setReelsHasMore(hasMore)
      setReelsMaxId(nextMaxId)
    } catch {
      /* on garde ce qui est deja affiche */
    } finally {
      setReelsLoadingMore(false)
    }
  }, [reelsHasMore, reelsMaxId, reelsLoadingMore])

  const loadSaved = useCallback(async (m: Mode) => {
    setSavedLoading(true)
    setError(null)
    setErrorCode(undefined)
    try {
      if (m === 'demo') {
        setSaved(demoSaved())
        setSavedHasMore(false)
        setSavedMaxId(null)
      } else {
        const { posts, hasMore, nextMaxId } = await api.saved()
        setSaved(posts)
        setSavedHasMore(hasMore)
        setSavedMaxId(nextMaxId)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors du chargement des enregistres.')
      setErrorCode(e instanceof ApiError ? e.code : undefined)
      setSaved([])
      setSavedHasMore(false)
      setSavedMaxId(null)
    } finally {
      setSavedLoading(false)
    }
  }, [])

  const loadMoreSaved = useCallback(async () => {
    if (modeRef.current !== 'live' || !savedHasMore || !savedMaxId || savedLoadingMore) return
    setSavedLoadingMore(true)
    try {
      const { posts, hasMore, nextMaxId } = await api.saved(savedMaxId)
      setSaved((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...posts.filter((p) => !seen.has(p.id))]
      })
      setSavedHasMore(hasMore)
      setSavedMaxId(nextMaxId)
    } catch {
      /* on garde ce qui est deja affiche */
    } finally {
      setSavedLoadingMore(false)
    }
  }, [savedHasMore, savedMaxId, savedLoadingMore])

  const prefetchMoreFeed = useCallback((maxId: string) => {
    if (feedFetchRef.current) return feedFetchRef.current
    const p = api
      .feed(maxId)
      .then(({ posts, hasMore, nextMaxId }) => {
        console.log(`[instaleo] fil pre-charge : ${posts.length} publications, encore plus ? ${hasMore}`)
        feedBufferRef.current = { maxId, posts, hasMore, nextMaxId }
      })
      .catch((e) => {
        console.warn('[instaleo] pre-chargement du fil echoue :', e)
        feedBufferRef.current = null
      })
      .finally(() => {
        feedFetchRef.current = null
      })
    feedFetchRef.current = p
    return p
  }, [])

  // Demarre/relance le prefetch de la suite du fil des qu'on sait qu'il y en
  // a, et qu'aucun buffer n'est deja pret pour ce point de pagination.
  useEffect(() => {
    if (modeRef.current !== 'live') return
    if (!feedHasMore || !feedNextMaxId) return
    if (feedBufferRef.current?.maxId === feedNextMaxId) return
    prefetchMoreFeed(feedNextMaxId)
  }, [feedHasMore, feedNextMaxId, prefetchMoreFeed])

  // Appele quand le repere en bas du fil devient visible.
  const loadMoreFeed = useCallback(() => {
    if (modeRef.current !== 'live') return // le mode demo n'a pas de pagination serveur
    if (!feedHasMore) return
    const buf = feedBufferRef.current

    if (buf && buf.maxId === feedNextMaxId) {
      feedBufferRef.current = null
      setFeed((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...buf.posts.filter((p) => !seen.has(p.id))]
      })
      setFeedHasMore(buf.hasMore)
      setFeedNextMaxId(buf.nextMaxId)
      if (buf.hasMore && buf.nextMaxId) prefetchMoreFeed(buf.nextMaxId)
      return
    }

    // Pas encore pret : court chargement, fusion des que le prefetch termine.
    if (feedNextMaxId) {
      setFeedLoadingMore(true)
      prefetchMoreFeed(feedNextMaxId).then(() => {
        const b = feedBufferRef.current
        if (b) {
          feedBufferRef.current = null
          setFeed((prev) => {
            const seen = new Set(prev.map((p) => p.id))
            return [...prev, ...b.posts.filter((p) => !seen.has(p.id))]
          })
          setFeedHasMore(b.hasMore)
          setFeedNextMaxId(b.nextMaxId)
          if (b.hasMore && b.nextMaxId) prefetchMoreFeed(b.nextMaxId)
        }
        setFeedLoadingMore(false)
      })
    }
  }, [feedHasMore, feedNextMaxId, prefetchMoreFeed])

  const loadInbox = useCallback(async (m: Mode) => {
    setThreadsLoading(true)
    setError(null)
    setErrorCode(undefined)
    try {
      if (m === 'demo') {
        setThreads(demoThreadPreviews())
      } else {
        const { threads: t } = await api.inbox()
        setThreads(t)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors du chargement des messages.')
      setErrorCode(e instanceof ApiError ? e.code : undefined)
      setThreads([])
    } finally {
      setThreadsLoading(false)
    }
  }, [])

  const openThread = useCallback((id: string) => {
    setActiveThreadId(id)
    setActiveThread(null)
    setThreadLoading(true)
    setError(null)
    setErrorCode(undefined)
    olderBufferRef.current = null
    const reqId = ++threadReq.current
    const m = modeRef.current
    ;(async () => {
      try {
        let thread: Thread | undefined
        if (m === 'demo') {
          thread = demoThreadById(id)
        } else {
          thread = (await api.thread(id)).thread
        }
        if (reqId !== threadReq.current) return
        setActiveThread(thread ?? null)
      } catch (e) {
        if (reqId !== threadReq.current) return
        setError(e instanceof ApiError ? e.message : 'Erreur lors du chargement de la conversation.')
        setErrorCode(e instanceof ApiError ? e.code : undefined)
      } finally {
        if (reqId === threadReq.current) setThreadLoading(false)
      }
    })()
  }, [])

  const prefetchOlder = useCallback((threadId: string, cursor: string) => {
    if (olderFetchRef.current) return olderFetchRef.current
    const p = api
      .thread(threadId, cursor)
      .then(({ thread: older }) => {
        console.log(
          `[instaleo] historique pre-charge (${threadId}) : ${older.messages.length} messages, encore plus ancien ? ${older.hasOlder}`,
        )
        olderBufferRef.current = {
          threadId,
          messages: older.messages,
          hasOlder: Boolean(older.hasOlder),
          oldestCursor: older.oldestCursor ?? null,
        }
      })
      .catch((e) => {
        console.warn('[instaleo] pre-chargement de l’historique echoue :', e)
        olderBufferRef.current = null // sera retente au prochain declenchement
      })
      .finally(() => {
        olderFetchRef.current = null
      })
    olderFetchRef.current = p
    return p
  }, [])

  // Demarre/relance le prefetch des qu'une page plus ancienne est disponible
  // et qu'aucun buffer n'est deja pret pour ce thread.
  useEffect(() => {
    if (modeRef.current !== 'live') return
    if (!activeThread?.hasOlder || !activeThread.oldestCursor) return
    if (olderBufferRef.current?.threadId === activeThread.id) return
    prefetchOlder(activeThread.id, activeThread.oldestCursor)
  }, [activeThread?.id, activeThread?.hasOlder, activeThread?.oldestCursor, prefetchOlder])

  function mergeOlder(
    t: Thread,
    buf: { messages: Message[]; hasOlder: boolean; oldestCursor: string | null },
  ): Thread {
    const seen = new Set(t.messages.map((m) => m.id))
    const prepend = buf.messages.filter((m) => !seen.has(m.id))
    return {
      ...t,
      messages: [...prepend, ...t.messages],
      hasOlder: buf.hasOlder,
      oldestCursor: buf.oldestCursor,
    }
  }

  // Remonte l'historique d'une conversation (appele quand le repere en haut
  // de la liste devient visible). Fusionne instantanement si le prefetch est
  // deja pret ; sinon attend la fin du prefetch en cours (rare, scroll tres
  // rapide sur une conversation qui vient d'ouvrir).
  const loadOlderMessages = useCallback(() => {
    if (modeRef.current !== 'live') return // le mode demo n'a pas de pagination
    setActiveThread((current) => {
      if (!current || !current.hasOlder) return current
      const buf = olderBufferRef.current

      if (buf && buf.threadId === current.id) {
        olderBufferRef.current = null
        const next = mergeOlder(current, buf)
        if (buf.hasOlder && buf.oldestCursor) prefetchOlder(current.id, buf.oldestCursor)
        return next
      }

      // Pas encore pret : on affiche un court chargement et on fusionne des
      // que le prefetch en cours (ou qu'on vient de lancer) se termine.
      if (current.oldestCursor) {
        setOlderLoading(true)
        prefetchOlder(current.id, current.oldestCursor).then(() => {
          setActiveThread((t) => {
            if (!t) return t
            const b = olderBufferRef.current
            if (!b || b.threadId !== t.id) return t
            olderBufferRef.current = null
            if (b.hasOlder && b.oldestCursor) prefetchOlder(t.id, b.oldestCursor)
            return mergeOlder(t, b)
          })
          setOlderLoading(false)
        })
      }
      return current
    })
  }, [prefetchOlder])

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !activeThread) return
      const localId = `local-${Date.now()}`
      const optimistic = {
        id: localId,
        senderId: me.pk,
        text: trimmed,
        timestamp: Math.floor(Date.now() / 1000),
        itemType: 'text' as const,
      }
      setActiveThread((t) =>
        t ? { ...t, messages: [...t.messages, optimistic] } : t,
      )
      if (modeRef.current === 'live') {
        api.send(activeThread.id, trimmed).catch((e) => {
          setError(e instanceof ApiError ? e.message : "L'envoi a echoue.")
          // La requete a reellement echoue : on ne laisse pas croire que le
          // message est parti. On le marque comme non envoye.
          setActiveThread((t) =>
            t
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === localId ? { ...m, failed: true } : m,
                  ),
                }
              : t,
          )
        })
      }
    },
    [activeThread, me.pk],
  )

  // Charge les donnees quand on change d'espace (ou de canal du fil).
  useEffect(() => {
    if (space === 'feed') {
      if (feedChannel === 'stories') loadStories(mode)
      else if (feedChannel === 'reels') loadReels(mode)
      else if (feedChannel === 'saved') loadSaved(mode)
      else loadFeed(mode)
    }
    if (space === 'direct') loadInbox(mode)
  }, [space, feedChannel, mode, loadFeed, loadInbox, loadStories, loadReels, loadSaved])

  const refreshFeed = useCallback(() => loadFeed(modeRef.current), [loadFeed])
  const refreshInbox = useCallback(() => loadInbox(modeRef.current), [loadInbox])
  const refreshStories = useCallback(() => loadStories(modeRef.current), [loadStories])

  // Au demarrage : detecte une session "live" existante (cookie), sinon demo.
  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then(({ user }) => {
        if (cancelled) return
        setMe(user)
        setMode('live')
      })
      .catch(() => {
        /* pas de session : on reste en demo */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onLoggedIn = useCallback((user: User) => {
    setMe(user)
    setMode('live')
    setLoginOpen(false)
    setActiveThread(null)
    setActiveThreadId(null)
    setError(null)
  }, [])

  const switchToDemo = useCallback(() => {
    setMode('demo')
    setMe(demoMe)
    setActiveThread(null)
    setActiveThreadId(null)
    setError(null)
  }, [])

  const logout = useCallback(() => {
    api.logout().catch(() => undefined)
    window.instaleoDesktop?.igLogout?.().catch?.(() => undefined)
    setSettingsOpen(false)
    switchToDemo()
  }, [switchToDemo])

  const value = useMemo<Store>(
    () => ({
      mode,
      me,
      space,
      setSpace,
      feedChannel,
      setFeedChannel,
      feed,
      feedLoading,
      feedLoadingMore,
      refreshFeed,
      loadMoreFeed,
      stories,
      storiesLoading,
      refreshStories,
      loadStoryItems,
      reels,
      reelsLoading,
      reelsLoadingMore,
      loadMoreReels,
      saved,
      savedLoading,
      savedLoadingMore,
      loadMoreSaved,
      threads,
      threadsLoading,
      refreshInbox,
      activeThreadId,
      activeThread,
      threadLoading,
      olderLoading,
      openThread,
      loadOlderMessages,
      sendMessage,
      error,
      errorCode,
      membersVisible,
      toggleMembers,
      loginOpen,
      setLoginOpen,
      settingsOpen,
      setSettingsOpen,
      onLoggedIn,
      logout,
      switchToDemo,
    }),
    [
      mode, me, space, feedChannel, feed, feedLoading, feedLoadingMore,
      refreshFeed, loadMoreFeed, stories, storiesLoading, refreshStories,
      loadStoryItems, reels, reelsLoading, reelsLoadingMore, loadMoreReels,
      saved, savedLoading, savedLoadingMore, loadMoreSaved, threads,
      threadsLoading, refreshInbox,
      activeThreadId, activeThread, threadLoading, olderLoading, openThread,
      loadOlderMessages, sendMessage,
      error, errorCode, membersVisible, toggleMembers, loginOpen, settingsOpen,
      onLoggedIn, logout, switchToDemo,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

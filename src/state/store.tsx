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
import type { Message, Post, SpaceId, Thread, ThreadPreview, User } from '../types'
import { api, ApiError } from '../lib/api'
import {
  demoFeed,
  demoMe,
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

  threads: ThreadPreview[]
  threadsLoading: boolean
  activeThreadId: string | null
  activeThread: Thread | null
  threadLoading: boolean
  olderLoading: boolean
  openThread: (id: string) => void
  loadOlderMessages: () => void
  sendMessage: (text: string) => void

  error: string | null

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

  const [threads, setThreads] = useState<ThreadPreview[]>([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
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

  const loadFeed = useCallback(async (m: Mode) => {
    setFeedLoading(true)
    setError(null)
    try {
      if (m === 'demo') {
        setFeed(demoFeed)
      } else {
        const { posts } = await api.feed()
        setFeed(posts)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors du chargement du fil.')
      setFeed([])
    } finally {
      setFeedLoading(false)
    }
  }, [])

  const loadInbox = useCallback(async (m: Mode) => {
    setThreadsLoading(true)
    setError(null)
    try {
      if (m === 'demo') {
        setThreads(demoThreadPreviews())
      } else {
        const { threads: t } = await api.inbox()
        setThreads(t)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur lors du chargement des messages.')
      setThreads([])
    } finally {
      setThreadsLoading(false)
    }
  }, [])

  const openThread = useCallback((id: string) => {
    setActiveThreadId(id)
    setActiveThread(null)
    setThreadLoading(true)
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

  // Charge les donnees quand on change d'espace.
  useEffect(() => {
    if (space === 'feed') loadFeed(mode)
    if (space === 'direct') loadInbox(mode)
  }, [space, mode, loadFeed, loadInbox])

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
      threads,
      threadsLoading,
      activeThreadId,
      activeThread,
      threadLoading,
      olderLoading,
      openThread,
      loadOlderMessages,
      sendMessage,
      error,
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
      mode, me, space, feedChannel, feed, feedLoading, threads, threadsLoading,
      activeThreadId, activeThread, threadLoading, olderLoading, openThread,
      loadOlderMessages, sendMessage,
      error, membersVisible, toggleMembers, loginOpen, settingsOpen,
      onLoggedIn, logout, switchToDemo,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

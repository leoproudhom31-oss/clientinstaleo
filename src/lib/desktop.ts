// Detection de l'app de bureau Electron + pont vers la connexion « vraie
// fenetre Instagram » (expose par electron/preload.cjs).

export interface InstaleoDesktop {
  isDesktop: boolean
  igLogin: () => Promise<{ ok: boolean; cancelled?: boolean }>
  igLogout: () => Promise<{ ok: boolean }>
  notify?: (title: string, body: string) => Promise<{ ok: boolean }>
}

declare global {
  interface Window {
    instaleoDesktop?: InstaleoDesktop
  }
}

export const desktop: InstaleoDesktop | undefined =
  typeof window !== 'undefined' ? window.instaleoDesktop : undefined

export const isDesktop = Boolean(desktop?.isDesktop)

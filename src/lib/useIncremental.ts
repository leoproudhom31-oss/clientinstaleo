import { useEffect, useRef, useState } from 'react'

// Affiche une liste par tranches (perf) : on rend `initial` elements, puis
// `step` de plus a chaque fois qu'un repere en bas de liste devient visible.
export function useIncremental<T>(items: T[], initial = 5, step = 5) {
  const [count, setCount] = useState(initial)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Repart de zero quand la liste change (nouveau chargement).
  useEffect(() => {
    setCount(initial)
  }, [items, initial])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCount((c) => Math.min(c + step, items.length))
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [items.length, step, count])

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    sentinelRef,
  }
}

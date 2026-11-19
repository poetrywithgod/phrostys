import { useEffect, useState } from 'react'
import Logo from './Logo'

const SEEN_KEY = 'phrostys-loader-seen'
const WRITE_FALLBACK_MS = 3400 // if the animation event never fires (reduced motion)
const HOLD_MS = 450 // a short pause once the logo is fully written
const HARD_CAP_MS = 8000 // open no matter what after this
const WIPE_MS = 900

type Phase = 'writing' | 'holding' | 'open' | 'gone'

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Full-screen opening animation: the Phrostys logo is written across the
 * screen, then the screen wipes upward to reveal the app. It plays once per
 * browser session and waits for the app to be ready before opening. The logo
 * takes the theme colour (deep green in light mode, lime in dark mode).
 */
export default function Loader({ ready }: { ready: boolean }) {
  const [phase, setPhase] = useState<Phase>(() => (alreadySeen() ? 'gone' : 'writing'))

  useEffect(() => {
    if (phase !== 'writing') return
    const t = setTimeout(() => setPhase('holding'), WRITE_FALLBACK_MS)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'holding' || !ready) return
    const t = setTimeout(() => setPhase('open'), HOLD_MS)
    return () => clearTimeout(t)
  }, [phase, ready])

  useEffect(() => {
    if (phase !== 'open') return
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, '1')
      } catch {
        /* ignore */
      }
      setPhase('gone')
    }, WIPE_MS)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p === 'gone' ? p : 'open')), HARD_CAP_MS)
    return () => clearTimeout(t)
  }, [])

  if (phase === 'gone') return null

  return (
    <div
      className={`loader is-writing${phase === 'open' ? ' is-open' : ''}`}
      role="status"
      aria-label="Loading Phrostys"
    >
      <Logo
        className="loader-logo"
        onAnimationEnd={() => setPhase((p) => (p === 'writing' ? 'holding' : p))}
      />
    </div>
  )
}

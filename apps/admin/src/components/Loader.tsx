import { useEffect, useState } from 'react'

const SEEN_KEY = 'phrostys-loader-seen'
const FONT_WAIT_MS = 1500 // never wait longer than this for Ewofi
const WRITE_FALLBACK_MS = 3200 // if the animation event never fires (reduced motion)
const HOLD_MS = 350 // short pause once the word is written
const HARD_CAP_MS = 8000 // open no matter what after this
const WIPE_MS = 900

type Phase = 'font' | 'writing' | 'holding' | 'open' | 'gone'

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Full-screen opening animation: "Phrostys" is written across the screen in
 * Ewofi, then the screen wipes upward to reveal the app. Plays once per
 * browser session, and waits for the app to be ready before opening.
 */
export default function Loader({ ready }: { ready: boolean }) {
  const [phase, setPhase] = useState<Phase>(() => (alreadySeen() ? 'gone' : 'font'))

  // Wait for the display font so the word never writes in a fallback face.
  useEffect(() => {
    if (phase !== 'font') return
    let live = true
    const go = () => live && setPhase('writing')
    const wait = new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS))
    Promise.race([document.fonts?.load('700 1em "Ewofi"') ?? Promise.resolve(), wait]).then(go, go)
    return () => {
      live = false
    }
  }, [phase])

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

  const writing = phase === 'writing' || phase === 'holding' || phase === 'open'
  return (
    <div
      className={`loader${writing ? ' is-writing' : ''}${phase === 'open' ? ' is-open' : ''}`}
      role="status"
      aria-label="Loading Phrostys"
    >
      <div className="loader-inner">
        <h1 className="loader-word" onAnimationEnd={() => setPhase((p) => (p === 'writing' ? 'holding' : p))}>
          Phrostys
        </h1>
      </div>
    </div>
  )
}

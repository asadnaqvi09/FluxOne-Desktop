import { useEffect, useRef } from 'react'
import { IDLE_MINUTES } from '@/lib/constants'

/**
 * Call onIdle after idleMinutes of no user activity.
 * Disabled when locked or enabled=false.
 */
export function useIdleLock({
  enabled = true,
  idleMinutes = IDLE_MINUTES,
  locked = false,
  onIdle,
} = {}) {
  const onIdleRef = useRef(onIdle)

  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  useEffect(() => {
    if (!enabled || locked) return undefined

    const minutes = Number(idleMinutes)
    const ms =
      Math.max(1, Number.isFinite(minutes) && minutes > 0 ? minutes : IDLE_MINUTES) *
      60 *
      1000

    let timer = window.setTimeout(() => {
      onIdleRef.current?.()
    }, ms)

    const bump = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        onIdleRef.current?.()
      }, ms)
    }

    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
    ]
    for (const ev of events) {
      window.addEventListener(ev, bump, { passive: true })
    }

    return () => {
      window.clearTimeout(timer)
      for (const ev of events) {
        window.removeEventListener(ev, bump)
      }
    }
  }, [enabled, idleMinutes, locked])
}

export default useIdleLock

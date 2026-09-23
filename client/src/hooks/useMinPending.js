import { useCallback, useState } from 'react'

/** Default for secondary actions (short feedback). */
const DEFAULT_MS = 500

/**
 * Primary session CTAs — Login, Sync, Open/Close cash drawer.
 * Keep spinner visible even when API is instant; navigate/modal AFTER run().
 */
export const CTA_MIN_PENDING_MS = 1800

/**
 * Keep CTA busy for at least `minMs` so spinners are visible on fast APIs.
 * run(asyncFn) → awaits both the work and the remaining min duration.
 */
export function useMinPending(minMs = DEFAULT_MS) {
  const [pending, setPending] = useState(false)

  const run = useCallback(
    async (work) => {
      setPending(true)
      // One short tick so React can paint the spinner before the API runs.
      await new Promise((r) => setTimeout(r, 50))
      const started = Date.now()
      try {
        return await work()
      } finally {
        const left = minMs - (Date.now() - started)
        if (left > 0) {
          await new Promise((r) => setTimeout(r, left))
        }
        setPending(false)
      }
    },
    [minMs],
  )

  return { pending, run }
}

export default useMinPending

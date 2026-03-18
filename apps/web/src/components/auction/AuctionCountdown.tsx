'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface AuctionCountdownProps {
  endTime: number // unix timestamp
  compact?: boolean
  className?: string
}

function getTimeLeft(endTime: number) {
  const diff = endTime * 1000 - Date.now()
  if (diff <= 0) return null
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  return { h, m, s, diff }
}

export function AuctionCountdown({ endTime, compact, className }: AuctionCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endTime))

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(endTime)), 1_000)
    return () => clearInterval(id)
  }, [endTime])

  if (!timeLeft) {
    return (
      <span className={cn('text-zinc-400 text-sm', className)}>Auction ended</span>
    )
  }

  const { h, m, s } = timeLeft
  const isUrgent = timeLeft.diff < 600_000 // < 10 min

  if (compact) {
    return (
      <span className={cn('text-xs font-mono font-semibold px-2 py-1 rounded-full', isUrgent ? 'text-red-300 bg-red-900/50' : 'text-white bg-black/50', className)}>
        {h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`}
      </span>
    )
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {[['h', h], ['m', m], ['s', s]].map(([unit, val]) => (
        <div key={unit as string} className="text-center">
          <div
            className={cn(
              'glass rounded-xl px-4 py-2 font-mono text-2xl font-bold tabular-nums min-w-[60px]',
              isUrgent ? 'text-red-400' : 'text-white'
            )}
          >
            {pad(val as number)}
          </div>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">{unit as string}</p>
        </div>
      ))}
    </div>
  )
}

'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { formatEther } from 'viem'
import { format } from 'date-fns'
import type { SaleEvent } from '@/types'

interface PriceHistoryProps {
  history: SaleEvent[]
}

export function PriceHistory({ history }: PriceHistoryProps) {
  const data = history.map(e => ({
    date: format(new Date(e.timestamp * 1000), 'MMM d'),
    price: parseFloat(formatEther(e.price)),
  }))

  data.reverse()
  return (
    <div className="glass rounded-2xl p-4">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v} ETH`}
            width={65}
          />
          <Tooltip
            contentStyle={{
              background: '#1e1e27',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
            }}
            formatter={(value) => [`${typeof value === 'number' ? value : '?'} ETH`, 'Sale Price']}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ fill: '#f97316', r: 3 }}
            activeDot={{ r: 5, fill: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

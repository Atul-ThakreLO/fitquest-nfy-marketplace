"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatUnits } from "viem";
import { format } from "date-fns";

interface PriceHistoryProps {
  history: Array<{ price: bigint; timestamp: number }>;
  seriesLabel?: string;
}

export function PriceHistory({
  history,
  seriesLabel = "Price",
}: PriceHistoryProps) {
  const data = [...history]
    .map((e) => ({
      ts: e.timestamp * 1000,
      price: parseFloat(formatUnits(e.price, 6)),
    }))
    .sort((a, b) => a.ts - b.ts);

  return (
    <div className="glass rounded-2xl p-4">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => format(new Date(Number(value)), "MMM d")}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v} USDC`}
            width={65}
          />
          <Tooltip
            contentStyle={{
              background: "#1e1e27",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
            labelFormatter={(value) =>
              format(new Date(Number(value)), "MMM d, HH:mm")
            }
            formatter={(value) => [
              `${typeof value === "number" ? value : "?"} USDC`,
              seriesLabel,
            ]}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ fill: "#f97316", r: 3 }}
            activeDot={{ r: 5, fill: "#fff" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ChartHint, ColumnDef } from '../types'

interface Props {
  chartHint: ChartHint
  columns: ColumnDef[]
  rows: Record<string, unknown>[]
}

export default function ChartView({ chartHint, columns, rows }: Props) {
  if (chartHint === 'none' || columns.length < 2 || rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic text-center py-8">
        No chart available for this result.
      </p>
    )
  }

  // Use first column as X axis, all remaining numeric columns as series
  const xKey = columns[0].field
  const yColumns = columns.slice(1).filter((c) => {
    const sample = rows[0]?.[c.field]
    return typeof sample === 'number' || (typeof sample === 'string' && !isNaN(Number(sample)))
  })

  if (yColumns.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic text-center py-8">
        No numeric columns available to chart.
      </p>
    )
  }

  const COLORS = ['#059669', '#374151', '#10b981', '#6b7280', '#34d399']

  const commonProps = {
    data: rows,
    margin: { top: 8, right: 16, left: 0, bottom: 4 },
  }

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey={xKey} tick={{ fill: '#6b7280', fontSize: 11 }} />
      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
      <Tooltip
        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6 }}
        labelStyle={{ color: '#111827' }}
      />
      <Legend wrapperStyle={{ color: '#6b7280', fontSize: 12 }} />
    </>
  )

  return (
    <ResponsiveContainer width="100%" height={300}>
      {chartHint === 'line' ? (
        <LineChart {...commonProps}>
          {axes}
          {yColumns.map((c, i) => (
            <Line
              key={c.field}
              type="monotone"
              dataKey={c.field}
              name={c.headerName}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
            />
          ))}
        </LineChart>
      ) : chartHint === 'scatter' ? (
        <ScatterChart {...commonProps}>
          {axes}
          <Scatter
            name={yColumns[0].headerName}
            data={rows}
            dataKey={yColumns[0].field}
            fill={COLORS[0]}
          />
        </ScatterChart>
      ) : (
        // bar | histogram — default
        <BarChart {...commonProps}>
          {axes}
          {yColumns.map((c, i) => (
            <Bar key={c.field} dataKey={c.field} name={c.headerName} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

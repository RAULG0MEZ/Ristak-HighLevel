import React from 'react'
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import styles from './BarChart.module.css'

export interface BarChartData {
  name: string
  value: number
}

interface BarChartProps {
  data: BarChartData[]
  loading?: boolean
  height?: number
  color?: string
  xAxisLabel?: string
  yAxisLabel?: string
  formatTooltip?: (value: number) => string
  formatXAxis?: (value: string) => string
}

// Tooltip personalizado que coincide con el diseño de LineChart
const CustomTooltip = ({ active, payload, formatTooltip }: any) => {
  if (!active || !payload || !payload.length) {
    return null
  }

  const data = payload[0].payload
  const value = payload[0].value

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{data.name}</p>
      <div className={styles.tooltipValue}>
        <span className={styles.tooltipDot} />
        <span>{formatTooltip(value)}</span>
      </div>
    </div>
  )
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  loading = false,
  height = 300,
  color = '#10b981', // Verde por defecto
  xAxisLabel,
  yAxisLabel,
  formatTooltip = (value) => value.toString(),
  formatXAxis = (value) => value
}) => {
  if (loading) {
    return (
      <div className={styles.loadingContainer} style={{ height: '100%' }}>
        <div className={styles.loadingSpinner} />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.emptyContainer} style={{ height: '100%' }}>
        <p className={styles.emptyMessage}>No hay datos disponibles para el período seleccionado</p>
      </div>
    )
  }

  return (
    <div className={styles.container} style={{ height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="var(--color-text-tertiary)"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            tickFormatter={formatXAxis}
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -10, fill: 'var(--color-text-tertiary)' } : undefined}
          />
          <YAxis
            stroke="var(--color-text-tertiary)"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            allowDecimals={false}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: 'var(--color-text-tertiary)' } : undefined}
          />
          <Tooltip
            content={<CustomTooltip formatTooltip={formatTooltip} />}
            cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
            isAnimationActive={false}
            allowEscapeViewBox={{ x: false, y: true }}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            animationDuration={300}
            isAnimationActive={true}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.value > 0 ? color : 'transparent'}
                style={{ cursor: entry.value > 0 ? 'pointer' : 'default' }}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

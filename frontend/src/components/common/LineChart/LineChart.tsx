import React from 'react'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'

interface DataPoint {
  label: string
  value: number
  value2?: number
}

interface LegendLabels {
  label1: string
  label2?: string
}

interface LineChartProps {
  data: DataPoint[]
  height?: number | string
  minHeight?: number | string
  showGrid?: boolean
  color?: string
  color2?: string
  showPoints?: boolean
  formatValue?: (value: number) => string
  formatTooltipValue?: (value: number, key: string) => string
  showLegend?: boolean
  legendLabels?: LegendLabels
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 400,
  minHeight = 320,
  showGrid = true,
  color = '#8b5cf6',
  color2 = '#3b82f6',
  showPoints = true,
  formatValue,
  formatTooltipValue,
  showLegend = false,
  legendLabels = { label1: 'Serie 1', label2: 'Serie 2' }
}) => {
  // Log para diagnóstico
  console.log('📈 LineChart rendering with data:', data)

  // Verificar si hay segunda serie
  const hasSecondSeries = data.some(d => typeof d.value2 === 'number')

  return (
    <div style={{ width: '100%', height: height || 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={data}
          margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          )}

          <XAxis
            dataKey="label"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />

          <YAxis
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />

          <Tooltip />

          {showLegend && <Legend />}

          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={showPoints}
            name={legendLabels.label1}
            isAnimationActive={false}
          />

          {hasSecondSeries && (
            <Line
              type="monotone"
              dataKey="value2"
              stroke={color2}
              strokeWidth={2}
              dot={showPoints}
              name={legendLabels.label2}
              isAnimationActive={false}
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
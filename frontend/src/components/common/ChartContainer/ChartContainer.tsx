import React from 'react'
import { cn } from '@/utils/cn'

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  height?: string | number
}

export function ChartContainer({
  className,
  title,
  subtitle,
  height = 300,
  children,
  ...props
}: ChartContainerProps) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      {(title || subtitle) && (
        <div>
          {title && <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>}
          {subtitle && <p className="text-sm text-[var(--color-text-tertiary)]">{subtitle}</p>}
        </div>
      )}
      <div className="relative" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        {children}
      </div>
    </div>
  )
}

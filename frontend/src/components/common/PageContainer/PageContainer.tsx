import React from 'react'
import { cn } from '@/utils/cn'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className }) => {
  return (
    <div data-ristak-page className={cn('px-6 pt-12 pb-16 text-[var(--color-text-primary)] md:px-10', className)}>
      <div data-ristak-page-inner className="mx-auto w-full max-w-6xl lg:max-w-7xl">{children}</div>
    </div>
  )
}

import React from 'react'
import styles from './Logo.module.css'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const sizeClasses: Record<NonNullable<LogoProps['size']>, string | undefined> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
  '2xl': styles.size2xl
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  return (
    <span className={`${styles.logo} ${sizeClasses[size] || ''} ${className}`} role="img" aria-label="ristak">
      ristak
    </span>
  )
}

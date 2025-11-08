import React from 'react'
import { Loader2 } from 'lucide-react'
import styles from './Loading.module.css'

interface LoadingProps {
  message?: string
  fullScreen?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Cargando',
  fullScreen = true,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  const containerClass = fullScreen ? styles.fullScreenContainer : styles.container

  return (
    <div className={containerClass}>
      <div className={styles.loadingWrapper}>
        <Loader2 className={`${sizeClasses[size]} ${styles.spinner}`} />
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  )
}
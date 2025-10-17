import React, { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import apiClient from '@/services/apiClient'
import styles from './StorageAlert.module.css'

interface StorageStatus {
  sizeGB: number
  sizePretty?: string
  limitGB: number
  percentUsed: number
  warningThreshold: number
  needsAttention: boolean
  message: string
}

export const StorageAlert: React.FC = () => {
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Verificar storage al cargar
    checkStorage()

    // Verificar cada 1 hora
    const interval = setInterval(checkStorage, 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const checkStorage = async () => {
    try {
      const data = await apiClient.get<StorageStatus>('/dashboard/storage-status')
      setStorageStatus(data)

      // Si ya no necesita atención, quitar el dismissed
      if (!data.needsAttention) {
        setDismissed(false)
      }
    } catch (error) {
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  // No mostrar si no hay problema o si fue dismissed
  if (!storageStatus?.needsAttention || dismissed) {
    return null
  }

  return (
    <div className={styles.alert}>
      <div className={styles.content}>
        <AlertTriangle className={styles.icon} size={20} />
        <div className={styles.text}>
          <strong>Alerta de Storage:</strong> Base de datos usando{' '}
          <strong>{storageStatus.percentUsed}%</strong> del espacio disponible (
          {storageStatus.sizePretty || `${storageStatus.sizeGB}GB`} de {storageStatus.limitGB}GB).
          <a
            href="https://dashboard.render.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Aumentar storage en Render
          </a>
        </div>
        <button
          onClick={handleDismiss}
          className={styles.closeButton}
          title="Cerrar alerta"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

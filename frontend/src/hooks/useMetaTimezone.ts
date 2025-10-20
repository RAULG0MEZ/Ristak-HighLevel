import { useState, useEffect } from 'react'
import { campaignsService } from '@/services/campaignsService'
import { useTimezone } from '@/contexts/TimezoneContext'

interface MetaTimezoneInfo {
  metaTimezoneName: string | null
  metaTimezoneOffset: number | null
  highLevelTimezoneName: string
  highLevelTimezoneOffset: number | null
  hasDiscrepancy: boolean
  discrepancyHours: number
  isLoading: boolean
}

/**
 * Hook para detectar discrepancias entre el timezone de Meta Ads y HighLevel
 *
 * @returns Información sobre los timezones y si hay discrepancia
 */
export function useMetaTimezone(): MetaTimezoneInfo {
  const { timezone } = useTimezone()
  const [metaTimezoneName, setMetaTimezoneName] = useState<string | null>(null)
  const [metaTimezoneOffset, setMetaTimezoneOffset] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchMetaTimezone = async () => {
      try {
        const response = await campaignsService.getMetaConfig()

        if (response.configured && response.config) {
          setMetaTimezoneName(response.config.timezoneName)
          setMetaTimezoneOffset(response.config.timezoneOffsetHoursUtc)
        }
      } catch (error) {
        // Silently fail, no timezone info available
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetaTimezone()
  }, [])

  // Calcular offset de HighLevel usando Intl API
  const getHighLevelTimezoneOffset = (tz: string): number => {
    try {
      const now = new Date()
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }))
      const offsetMs = utcDate.getTime() - tzDate.getTime()
      return offsetMs / (1000 * 60 * 60) // Convertir a horas
    } catch {
      return 0
    }
  }

  const highLevelTimezoneOffset = getHighLevelTimezoneOffset(timezone)

  // Detectar discrepancia
  const hasDiscrepancy = metaTimezoneOffset !== null &&
                        Math.abs(metaTimezoneOffset - highLevelTimezoneOffset) > 0.5 // Tolerancia de 30 minutos

  const discrepancyHours = metaTimezoneOffset !== null
    ? Math.abs(metaTimezoneOffset - highLevelTimezoneOffset)
    : 0

  return {
    metaTimezoneName,
    metaTimezoneOffset,
    highLevelTimezoneName: timezone,
    highLevelTimezoneOffset,
    hasDiscrepancy,
    discrepancyHours,
    isLoading
  }
}

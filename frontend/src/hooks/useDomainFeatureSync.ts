import { useEffect, useRef } from 'react'
import { useAppConfig } from './useAppConfig'
import { trackingService } from '@/services/trackingService'

type VisitorSource = 'platform' | 'tracking'

/**
 * Habilita automáticamente las preferencias dependientes del rastreo
 * (visibilidad de Analíticas y fuente de visitantes) cuando existe
 * configuración de tracking, sin importar desde qué host se cargó la app.
 */
export const useDomainFeatureSync = () => {
  const [showAnalytics, setShowAnalytics] = useAppConfig<boolean>('show_analytics', false)
  const [visitorSource, setVisitorSource] = useAppConfig<VisitorSource>('visitor_source', 'platform')
  const syncingRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    // Ya estamos en el estado esperado, no hacer nada
    if (showAnalytics === true && visitorSource === 'tracking') {
      return
    }

    const syncPreferences = async () => {
      if (syncingRef.current) return
      syncingRef.current = true

      let analyticsChanged = false
      let visitorChanged = false

      try {
        let shouldEnable = true

        try {
          const config = await trackingService.getTrackingConfig()
          shouldEnable = Boolean(config?.trackingDomain?.trim()) ||
            Boolean(config?.showAnalytics) ||
            Boolean(config?.isConfigured)
        } catch {
          // Si la API falla, preferimos habilitar (fail-open) para no ocultar Analíticas por error transitorio
          shouldEnable = true
        }

        if (!shouldEnable) return

        if (!showAnalytics) {
          await setShowAnalytics(true)
          analyticsChanged = true
        }
        if (visitorSource !== 'tracking') {
          await setVisitorSource('tracking')
          visitorChanged = true
        }

        if (!cancelled) {
          if (analyticsChanged) {
            window.dispatchEvent(new CustomEvent('analytics-preference-changed', {
              detail: { showAnalytics: true }
            }))
          }
          if (visitorChanged) {
            window.dispatchEvent(new CustomEvent('visitor-source-changed', {
              detail: { visitorSource: 'tracking' }
            }))
          }
        }
      } catch {
      } finally {
        syncingRef.current = false
      }
    }

    syncPreferences()

    return () => {
      cancelled = true
    }
  }, [showAnalytics, visitorSource, setShowAnalytics, setVisitorSource])
}

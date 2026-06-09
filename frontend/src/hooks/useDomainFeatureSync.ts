import { useEffect, useRef } from 'react'
import { useAppConfig } from './useAppConfig'
import { trackingService } from '@/services/trackingService'

type VisitorSource = 'platform' | 'tracking'

/**
 * Mantiene Analíticas visibles sin importar desde qué host se cargó la app.
 *
 * Si el rastreo web ya está configurado, también activa esa fuente de visitantes.
 * Si no está configurado, no cambia la fuente existente.
 */
export const useDomainFeatureSync = () => {
  const [showAnalytics, setShowAnalytics] = useAppConfig<boolean>('show_analytics', true)
  const [visitorSource, setVisitorSource] = useAppConfig<VisitorSource>('visitor_source', 'platform')
  const syncingRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const syncPreferences = async () => {
      if (syncingRef.current) return
      syncingRef.current = true

      let analyticsChanged = false
      let visitorChanged = false

      try {
        if (!showAnalytics) {
          await setShowAnalytics(true)
          analyticsChanged = true
        }

        try {
          const config = await trackingService.getTrackingConfig()
          if (config?.isConfigured && visitorSource !== 'tracking') {
            await setVisitorSource('tracking')
            visitorChanged = true
          }
        } catch {
          // Si la API falla, Analíticas se queda visible y no cambiamos la fuente de visitantes.
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

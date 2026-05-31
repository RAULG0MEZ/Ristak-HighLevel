import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Sistema HÍBRIDO de configuración:
 * - LocalStorage como CACHE (lectura instantánea)
 * - PostgreSQL como SOURCE OF TRUTH (persistencia confiable)
 * - Sincronización automática entre ambos
 */

const CONFIG_PREFIX = 'rstk_config_'
const SYNC_EVENT = 'config-sync'

interface ConfigOptions {
  syncOnMount?: boolean // Sincronizar con DB al montar (default: true)
  cacheFirst?: boolean // Usar localStorage como cache (default: true)
}

/**
 * Hook para manejar configuración individual de la app
 *
 * @param key - Clave de configuración (ej: 'visitor_source', 'show_analytics')
 * @param defaultValue - Valor por default si no existe
 * @param options - Opciones de comportamiento
 *
 * @example
 * const [visitorSource, setVisitorSource] = useAppConfig('visitor_source', 'platform')
 */
export function useAppConfig<T = string>(
  key: string,
  defaultValue: T,
  options: ConfigOptions = {}
): [T, (value: T) => Promise<void>, boolean] {
  const { syncOnMount = true, cacheFirst = true } = options

  // Estado local
  const [value, setValue] = useState<T>(() => {
    if (!cacheFirst) return defaultValue

    // Leer del cache inmediatamente (rápido)
    try {
      const cached = localStorage.getItem(`${CONFIG_PREFIX}${key}`)
      if (cached !== null) {
        return JSON.parse(cached) as T
      }
    } catch {
      // Ignore cache read errors and fall back to default value
    }
    return defaultValue
  })

  const [syncing, setSyncing] = useState(false)
  const mountedRef = useRef(true)

  // Sincronizar con la DB al montar
  useEffect(() => {
    mountedRef.current = true

    if (!syncOnMount) return

    const syncFromDB = async () => {
      try {
        const response = await fetch(`/api/config?keys=${key}`)
        if (!response.ok) throw new Error('Failed to fetch config')

        const data = await response.json()
        const dbValue = data.config?.[key]

        if (dbValue !== undefined && dbValue !== null && mountedRef.current) {
          const parsed = typeof defaultValue === 'string' ? dbValue : JSON.parse(dbValue)

          // Solo actualizar si es diferente del cache
          setValue((current) => {
            if (JSON.stringify(current) !== JSON.stringify(parsed)) {
              if (cacheFirst) {
                localStorage.setItem(`${CONFIG_PREFIX}${key}`, JSON.stringify(parsed))
              }
              return parsed
            }
            return current
          })
        }
      } catch {
        // Keep cached value when DB sync fails
      }
    }

    syncFromDB()

    return () => {
      mountedRef.current = false
    }
  }, [key, syncOnMount, cacheFirst]) // Removido defaultValue de deps

  // Escuchar cambios desde otros componentes
  useEffect(() => {
    const handleSync = (event: CustomEvent) => {
      const { key: changedKey, value: newValue } = event.detail
      if (changedKey === key && mountedRef.current) {
        setValue(newValue)
      }
    }

    window.addEventListener(SYNC_EVENT, handleSync as EventListener)
    return () => window.removeEventListener(SYNC_EVENT, handleSync as EventListener)
  }, [key])

  // Función para actualizar el valor
  const updateValue = useCallback(async (newValue: T) => {
    setSyncing(true)

    try {
      // 1. Guardar en DB (source of truth)
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: typeof newValue === 'string' ? newValue : JSON.stringify(newValue)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save config')
      }

      // 2. Actualizar cache local si esta config lo permite
      if (cacheFirst) {
        localStorage.setItem(`${CONFIG_PREFIX}${key}`, JSON.stringify(newValue))
      }

      // 3. Actualizar estado local
      if (mountedRef.current) {
        setValue(newValue)
      }

      // 4. Notificar a otros componentes
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, {
        detail: { key, value: newValue }
      }))
    } catch (error) {
      throw error
    } finally {
      if (mountedRef.current) {
        setSyncing(false)
      }
    }
  }, [key, cacheFirst])

  return [value, updateValue, syncing]
}

/**
 * Hook para manejar configuración de tablas (columnas visibles, orden, etc)
 *
 * @param tableId - ID de la tabla (ej: 'contacts', 'campaigns')
 * @returns Configuración de la tabla y función para actualizarla
 *
 * @example
 * const [tableConfig, setTableConfig] = useTableConfig('contacts')
 */
export function useTableConfig<T = any>(tableId: string) {
  const key = `table_${tableId}`
  const [config, updateConfig, syncing] = useAppConfig<T | null>(key, null, {
    syncOnMount: true,
    cacheFirst: true
  })

  return [config, updateConfig, syncing] as const
}

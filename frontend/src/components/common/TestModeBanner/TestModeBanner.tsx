import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { getStripeConfig } from '@/services/paymentMethodsService'

export const TestModeBanner = () => {
  const [isTestMode, setIsTestMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const config = await getStripeConfig()
      // Solo mostrar si Stripe está configurado Y está en modo test
      setIsTestMode(config.configured && config.mode === 'test')
    } catch (error) {
      console.error('Error al cargar configuración de Stripe:', error)
    } finally {
      setLoading(false)
    }
  }

  // No mostrar nada mientras carga o si está en modo live/no configurado
  if (loading || !isTestMode) {
    return null
  }

  return (
    <div className="bg-yellow-500 dark:bg-yellow-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-md">
      <AlertTriangle className="h-4 w-4" />
      <span>MODO DE PRUEBA ACTIVO - Los pagos no son reales</span>
    </div>
  )
}

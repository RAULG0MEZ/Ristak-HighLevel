import React, { useState, useEffect } from 'react'
import { Card, Button } from '@/components/common'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'
import { useNotification } from '@/contexts/NotificationContext'
import { getStripeConfig, saveStripeConfig } from '@/services/paymentMethodsService'
import styles from './StripeIntegration.module.css'

export const StripeIntegration: React.FC = () => {
  const { showToast } = useNotification()

  // Estados de configuración
  const [stripeTestKey, setStripeTestKey] = useState('')
  const [stripeLiveKey, setStripeLiveKey] = useState('')
  const [stripeMode, setStripeMode] = useState<'test' | 'live'>('test')
  const [showStripeTestKey, setShowStripeTestKey] = useState(false)
  const [showStripeLiveKey, setShowStripeLiveKey] = useState(false)
  const [loadingStripe, setLoadingStripe] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [hasTestKey, setHasTestKey] = useState(false)
  const [hasLiveKey, setHasLiveKey] = useState(false)

  useEffect(() => {
    loadStripeConfig()
  }, [])

  const loadStripeConfig = async () => {
    try {
      const config = await getStripeConfig()

      if (config.configured) {
        setIsConfigured(true)
        setStripeMode(config.mode || 'test')
        setHasTestKey(config.hasTestKey)
        setHasLiveKey(config.hasLiveKey)

        // Mostrar preview ofuscado
        if (config.hasTestKey) {
          setStripeTestKey('sk_test_************************************')
        }
        if (config.hasLiveKey) {
          setStripeLiveKey('sk_live_************************************')
        }
      }
    } catch (error) {
      console.error('Error cargando configuración de Stripe:', error)
    }
  }

  const handleSaveStripeConfig = async () => {
    // Validar que al menos una key esté presente
    const hasValidTestKey = stripeTestKey.trim() && !stripeTestKey.startsWith('sk_test_***')
    const hasValidLiveKey = stripeLiveKey.trim() && !stripeLiveKey.startsWith('sk_live_***')

    if (!hasValidTestKey && !hasValidLiveKey) {
      showToast('error', 'Debes proporcionar al menos una Secret Key')
      return
    }

    setLoadingStripe(true)
    try {
      await saveStripeConfig({
        testSecretKey: hasValidTestKey ? stripeTestKey.trim() : undefined,
        liveSecretKey: hasValidLiveKey ? stripeLiveKey.trim() : undefined,
        mode: stripeMode
      })

      showToast('success', 'Configuración de Stripe guardada exitosamente')

      // Recargar config
      await loadStripeConfig()
    } catch (error: any) {
      showToast('error', error.message || 'Error al guardar configuración de Stripe')
    } finally {
      setLoadingStripe(false)
    }
  }

  const handleToggleMode = async () => {
    const newMode = stripeMode === 'test' ? 'live' : 'test'

    setLoadingStripe(true)
    try {
      await saveStripeConfig({
        mode: newMode
      })

      setStripeMode(newMode)
      showToast('success', `Stripe ahora está en modo ${newMode === 'test' ? 'pruebas' : 'producción'}`)
    } catch (error: any) {
      showToast('error', error.message || 'No se pudo cambiar el modo')
    } finally {
      setLoadingStripe(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Estás seguro de que deseas desconectar Stripe? Se eliminarán todas las configuraciones.')) {
      return
    }

    setLoadingStripe(true)
    try {
      await saveStripeConfig({
        testSecretKey: '',
        liveSecretKey: '',
        mode: 'test'
      })

      // Resetear estado
      setIsConfigured(false)
      setStripeTestKey('')
      setStripeLiveKey('')
      setStripeMode('test')
      setHasTestKey(false)
      setHasLiveKey(false)

      showToast('success', 'Stripe desconectado exitosamente')
    } catch (error: any) {
      showToast('error', error.message || 'Error al desconectar Stripe')
    } finally {
      setLoadingStripe(false)
    }
  }

  return (
    <div className={styles.container}>
      <Card>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <div className={styles.logo}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#635BFF"/>
                <path d="M14.286 13.714c0-.857.714-1.143 1.857-1.143 1.571 0 3.571.5 5.143 1.357V9.857c-1.714-.714-3.428-1-5.143-1-4.214 0-7 2.214-7 5.928 0 5.786 7.928 4.857 7.928 7.357 0 .928-.786 1.214-1.928 1.214-1.714 0-3.928-.714-5.643-1.643v4.143c1.928.857 3.857 1.214 5.643 1.214 4.286 0 7.214-2.143 7.214-5.928 0-6.214-7.928-5.143-7.928-7.428z" fill="white"/>
              </svg>
            </div>
            <div>
              <h3 className={styles.title}>Stripe</h3>
              <p className={styles.subtitle}>
                {isConfigured ? 'Conectado correctamente' : 'Configura tus credenciales para cobrar a tarjetas guardadas'}
              </p>
            </div>
          </div>
          {isConfigured && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={loadingStripe}
            >
              Desconectar
            </Button>
          )}
        </div>

        <div className={styles.content}>
          {isConfigured ? (
            /* VISTA CONFIGURADO: Solo toggle */
            <div className={styles.configuredView}>
              <div className={styles.modeCard}>
                <h4 className={styles.modeTitle}>Modo de Operación</h4>
                <p className={styles.modeDescription}>
                  {stripeMode === 'test'
                    ? 'Usando tarjetas de prueba (sandbox)'
                    : 'Usando tarjetas reales (producción)'}
                </p>

                <div className={styles.toggleContainer}>
                  <span className={`${styles.toggleLabel} ${stripeMode === 'test' ? styles.toggleLabelActive : ''}`}>
                    🧪 Test
                  </span>

                  <button
                    onClick={handleToggleMode}
                    className={`${styles.toggle} ${stripeMode === 'live' ? styles.toggleActive : ''}`}
                    disabled={loadingStripe}
                  >
                    <span className={styles.toggleThumb} />
                  </button>

                  <span className={`${styles.toggleLabel} ${stripeMode === 'live' ? styles.toggleLabelActive : ''}`}>
                    ⚡ Live
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* VISTA NO CONFIGURADO: Formulario completo */
            <div className={styles.formView}>
              {/* Radio buttons para modo */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Modo de Operación</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="test"
                      checked={stripeMode === 'test'}
                      onChange={(e) => setStripeMode(e.target.value as 'test' | 'live')}
                      className={styles.radio}
                    />
                    <span>Modo Test (Sandbox)</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="live"
                      checked={stripeMode === 'live'}
                      onChange={(e) => setStripeMode(e.target.value as 'test' | 'live')}
                      className={styles.radio}
                    />
                    <span>Modo Live (Producción)</span>
                  </label>
                </div>
                <p className={styles.hint}>
                  {stripeMode === 'test'
                    ? '🧪 Modo de pruebas - usa tarjetas de test como 4242 4242 4242 4242'
                    : '⚡ Modo de producción - se cobrarán tarjetas reales'}
                </p>
              </div>

              {/* Test Secret Key */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Test Secret Key (Sandbox)</label>
                <div className={styles.inputGroup}>
                  <input
                    type={showStripeTestKey ? 'text' : 'password'}
                    value={stripeTestKey}
                    onChange={(e) => setStripeTestKey(e.target.value)}
                    placeholder="sk_test_..."
                    className={styles.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStripeTestKey(!showStripeTestKey)}
                    className={styles.inputButton}
                  >
                    {showStripeTestKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className={styles.hint}>
                  Para pruebas. Obtén tu Test Key en{' '}
                  <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer" className={styles.link}>
                    Stripe Dashboard <ExternalLink size={14} />
                  </a>
                </p>
              </div>

              {/* Live Secret Key */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Live Secret Key (Producción)</label>
                <div className={styles.inputGroup}>
                  <input
                    type={showStripeLiveKey ? 'text' : 'password'}
                    value={stripeLiveKey}
                    onChange={(e) => setStripeLiveKey(e.target.value)}
                    placeholder="sk_live_..."
                    className={styles.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStripeLiveKey(!showStripeLiveKey)}
                    className={styles.inputButton}
                  >
                    {showStripeLiveKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className={styles.hint}>
                  Para cobros reales. Obtén tu Live Key en{' '}
                  <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className={styles.link}>
                    Stripe Dashboard <ExternalLink size={14} />
                  </a>
                </p>
              </div>

              {/* Info card */}
              <div className={styles.infoCard}>
                <div className={styles.infoIcon}>
                  <AlertCircle size={20} />
                </div>
                <div className={styles.infoContent}>
                  <h4 className={styles.infoTitle}>💳 ¿Para qué sirve esto?</h4>
                  <p className={styles.infoText}>
                    Stripe te permite cobrar a tarjetas guardadas de tus clientes. Cuando un cliente
                    pague un invoice por primera vez, su tarjeta se guardará automáticamente para futuros cobros.
                  </p>
                  <ul className={styles.infoList}>
                    <li><strong>Test Key:</strong> Para pruebas con tarjetas de test (4242 4242 4242 4242)</li>
                    <li><strong>Live Key:</strong> Para cobros reales a clientes</li>
                    <li><strong>Seguridad:</strong> Las keys se guardan cifradas en la base de datos</li>
                  </ul>
                </div>
              </div>

              {/* Botón guardar */}
              <Button
                onClick={handleSaveStripeConfig}
                disabled={loadingStripe}
                className={styles.saveButton}
              >
                {loadingStripe ? (
                  <>
                    <Loader2 size={18} className={styles.spinner} />
                    Guardando...
                  </>
                ) : (
                  <>
                    💾 Guardar Configuración de Stripe
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

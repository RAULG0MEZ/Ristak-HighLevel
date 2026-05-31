import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MonitorX } from 'lucide-react'
import { AIAgentPanel } from '@/components/ai'
import styles from './PhoneAgentChat.module.css'

const PHONE_WIDTH_QUERY = '(max-width: 767px)'
const COARSE_POINTER_QUERY = '(pointer: coarse)'
const MOBILE_USER_AGENT_PATTERN = /Android|iPhone|iPod|IEMobile|Opera Mini|Mobile/i

type AccessState = 'checking' | 'allowed' | 'blocked'

function hasPhoneAccess() {
  if (typeof window === 'undefined') return false

  const phoneViewport = window.matchMedia(PHONE_WIDTH_QUERY).matches
  const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY).matches
  const mobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent || '')

  return phoneViewport && (mobileUserAgent || coarsePointer)
}

function getAccessState(): AccessState {
  if (typeof window === 'undefined') return 'checking'
  return hasPhoneAccess() ? 'allowed' : 'blocked'
}

export const PhoneAgentChat: React.FC = () => {
  const [accessState, setAccessState] = useState<AccessState>(getAccessState)

  useEffect(() => {
    document.title = 'Agente AI movil | Ristak'

    const updateAccess = () => setAccessState(getAccessState())
    const phoneMedia = window.matchMedia(PHONE_WIDTH_QUERY)
    const pointerMedia = window.matchMedia(COARSE_POINTER_QUERY)

    updateAccess()
    phoneMedia.addEventListener('change', updateAccess)
    pointerMedia.addEventListener('change', updateAccess)
    window.addEventListener('resize', updateAccess)
    window.addEventListener('orientationchange', updateAccess)
    window.visualViewport?.addEventListener('resize', updateAccess)

    return () => {
      phoneMedia.removeEventListener('change', updateAccess)
      pointerMedia.removeEventListener('change', updateAccess)
      window.removeEventListener('resize', updateAccess)
      window.removeEventListener('orientationchange', updateAccess)
      window.visualViewport?.removeEventListener('resize', updateAccess)
    }
  }, [])

  if (accessState === 'checking') {
    return (
      <main className={styles.loadingPage}>
        <span className={styles.loadingDot} />
      </main>
    )
  }

  if (accessState === 'blocked') {
    return (
      <main className={styles.blockedPage}>
        <section className={styles.blockedPanel} aria-labelledby="phone-agent-blocked-title">
          <div className={styles.blockedIcon} aria-hidden="true">
            <MonitorX size={28} />
          </div>
          <div className={styles.blockedCopy}>
            <p className={styles.eyebrow}>Ruta bloqueada</p>
            <h1 id="phone-agent-blocked-title">Solo en celular</h1>
            <p>
              Esta pantalla del agente AI esta cerrada para computadora. Abrela desde un telefono para usar el chat en modo movil.
            </p>
          </div>
          <Link className={styles.dashboardLink} to="/dashboard">
            Volver al dashboard
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.mobilePage} aria-label="Chat movil del agente AI">
      <AIAgentPanel variant="embedded" />
    </main>
  )
}

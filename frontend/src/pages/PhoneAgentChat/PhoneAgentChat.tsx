import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MonitorX } from 'lucide-react'
import { AIAgentPanel } from '@/components/ai'
import styles from './PhoneAgentChat.module.css'

const PORTABLE_WIDTH_QUERY = '(max-width: 1366px)'
const COARSE_POINTER_QUERY = '(pointer: coarse)'
const MOBILE_OR_TABLET_USER_AGENT_PATTERN = /Android|iPad|iPhone|iPod|IEMobile|Opera Mini|Mobile|Tablet/i

type AccessState = 'checking' | 'allowed' | 'blocked'

function hasPortableAccess() {
  if (typeof window === 'undefined') return false

  const portableViewport = window.matchMedia(PORTABLE_WIDTH_QUERY).matches
  const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY).matches
  const userAgent = navigator.userAgent || ''
  const mobileOrTabletUserAgent = MOBILE_OR_TABLET_USER_AGENT_PATTERN.test(userAgent)
  const iPadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1

  return portableViewport && (mobileOrTabletUserAgent || iPadDesktopMode || coarsePointer)
}

function getAccessState(): AccessState {
  if (typeof window === 'undefined') return 'checking'
  return hasPortableAccess() ? 'allowed' : 'blocked'
}

export const PhoneAgentChat: React.FC = () => {
  const [accessState, setAccessState] = useState<AccessState>(getAccessState)

  useEffect(() => {
    document.title = 'Agente AI movil y tablet | Ristak'

    const updateAccess = () => setAccessState(getAccessState())
    const portableMedia = window.matchMedia(PORTABLE_WIDTH_QUERY)
    const pointerMedia = window.matchMedia(COARSE_POINTER_QUERY)

    updateAccess()
    portableMedia.addEventListener('change', updateAccess)
    pointerMedia.addEventListener('change', updateAccess)
    window.addEventListener('resize', updateAccess)
    window.addEventListener('orientationchange', updateAccess)
    window.visualViewport?.addEventListener('resize', updateAccess)

    return () => {
      portableMedia.removeEventListener('change', updateAccess)
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
            <h1 id="phone-agent-blocked-title">Solo en móvil o tablet</h1>
            <p>
              Esta pantalla del agente AI está cerrada para computadora. Ábrela desde un teléfono o una tablet para usar el chat en modo portátil.
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
    <main className={styles.mobilePage} aria-label="Chat movil y tablet del agente AI">
      <AIAgentPanel variant="embedded" />
    </main>
  )
}

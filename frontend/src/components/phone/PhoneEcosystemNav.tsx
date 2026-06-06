import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CalendarDays, CreditCard, MessageCircle } from 'lucide-react'
import styles from './PhoneEcosystemNav.module.css'

type PhoneSection = 'chat' | 'calendar' | 'payments' | 'analytics'

interface PhoneEcosystemNavProps {
  active: PhoneSection
  badges?: Partial<Record<PhoneSection, number>>
}

const navItems = [
  { key: 'chat', label: 'Chats', to: '/phone/chat', Icon: MessageCircle },
  { key: 'calendar', label: 'Citas', to: '/phone/calendar', Icon: CalendarDays },
  { key: 'payments', label: 'Pagos', to: '/phone/payments', Icon: CreditCard },
  { key: 'analytics', label: 'Analíticas', to: '/phone/analytics', Icon: BarChart3 }
] as const

const NAV_STORAGE_KEY = 'ristak_phone_nav_active_index'

function clampNavIndex(index: number) {
  return Number.isFinite(index) ? Math.min(Math.max(index, 0), navItems.length - 1) : 0
}

function readStoredNavIndex(fallback: number) {
  if (typeof window === 'undefined') return fallback
  const storedIndex = Number(window.sessionStorage.getItem(NAV_STORAGE_KEY))
  return Number.isFinite(storedIndex) ? clampNavIndex(storedIndex) : fallback
}

export const PhoneEcosystemNav: React.FC<PhoneEcosystemNavProps> = ({ active, badges = {} }) => {
  const activeIndex = clampNavIndex(navItems.findIndex((item) => item.key === active))
  const [indicatorIndex, setIndicatorIndex] = useState(() => readStoredNavIndex(activeIndex))

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIndicatorIndex(activeIndex)
      return undefined
    }

    const frame = window.requestAnimationFrame(() => {
      setIndicatorIndex(activeIndex)
      window.sessionStorage.setItem(NAV_STORAGE_KEY, String(activeIndex))
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeIndex])

  return (
    <nav
      className={styles.dock}
      aria-label="Secciones de Ristak Chat"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <span
        className={styles.activeIndicator}
        style={{ transform: `translate3d(${indicatorIndex * 100}%, 0, 0)` }}
        aria-hidden="true"
      />
      {navItems.map(({ key, label, to, Icon }) => {
        const badgeCount = Math.max(0, Number(badges[key] || 0))

        return (
          <Link
            key={key}
            to={to}
            className={active === key ? styles.active : undefined}
            draggable={false}
            aria-current={active === key ? 'page' : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={key === 'chat' ? 25 : 24} aria-hidden="true" focusable="false" />
              {badgeCount > 0 && (
                <i aria-label={`${badgeCount} mensajes no leídos`}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </i>
              )}
            </span>
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

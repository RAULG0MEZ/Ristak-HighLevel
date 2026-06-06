import React, { useEffect, useState } from 'react'
import {
  PHONE_NAV_ROUTE_INDEX_KEY,
  PHONE_NAV_TRANSITION_DIRECTION_KEY,
  PHONE_NAV_TRANSITION_TARGET_KEY,
  getPhoneRouteDirection,
  getPhoneSectionIndex,
  type PhoneRouteDirection,
  type PhoneSection
} from './phoneNavigation'
import styles from './PhonePageTransition.module.css'

interface PhonePageTransitionProps extends React.HTMLAttributes<HTMLDivElement> {
  active: PhoneSection
  children: React.ReactNode
}

function readInitialDirection(activeIndex: number): PhoneRouteDirection {
  if (typeof window === 'undefined') return 'none'

  const storedDirection = window.sessionStorage.getItem(PHONE_NAV_TRANSITION_DIRECTION_KEY) as PhoneRouteDirection | null
  const targetIndex = Number(window.sessionStorage.getItem(PHONE_NAV_TRANSITION_TARGET_KEY))
  const hasMatchingIntent = targetIndex === activeIndex && (storedDirection === 'forward' || storedDirection === 'back')

  window.sessionStorage.removeItem(PHONE_NAV_TRANSITION_DIRECTION_KEY)
  window.sessionStorage.removeItem(PHONE_NAV_TRANSITION_TARGET_KEY)

  if (hasMatchingIntent) return storedDirection

  const previousIndex = Number(window.sessionStorage.getItem(PHONE_NAV_ROUTE_INDEX_KEY))
  if (!Number.isFinite(previousIndex)) return 'none'
  return getPhoneRouteDirection(previousIndex, activeIndex)
}

export const PhonePageTransition: React.FC<PhonePageTransitionProps> = ({ active, className, children, ...rest }) => {
  const activeIndex = getPhoneSectionIndex(active)
  const [direction] = useState(() => readInitialDirection(activeIndex))
  const directionClass = direction === 'forward'
    ? styles.forward
    : direction === 'back'
      ? styles.back
      : styles.none

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(PHONE_NAV_ROUTE_INDEX_KEY, String(activeIndex))
  }, [activeIndex])

  return (
    <div {...rest} className={`${className || ''} ${styles.transitionFrame} ${directionClass}`} data-phone-page-transition={direction}>
      {children}
    </div>
  )
}

export type RedirectLocation = {
  pathname?: string
  search?: string
  hash?: string
}

export const PHONE_APP_HOME_PATH = '/phone/chat'
export const PHONE_APP_LOGIN_PATH = '/phone/login'
export const DESKTOP_LOGIN_PATH = '/login'
export const SETUP_PATH = '/setup'

export type PortableDeviceMode = 'phone' | 'tablet' | 'desktop'

const PHONE_USER_AGENT_PATTERN = /Android.+Mobile|iPhone|iPod|IEMobile|Opera Mini|Windows Phone|Mobile/i
const TABLET_USER_AGENT_PATTERN = /iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i
const COARSE_POINTER_QUERY = '(pointer: coarse)'
const PHONE_SHORT_SIDE_LIMIT = 768
const IPAD_DESKTOP_SHORT_SIDE_LIMIT = 700
const TABLET_SHORT_SIDE_LIMIT = 1366

export function isPhoneAppPath(pathname = '') {
  return pathname === '/phone' || pathname.startsWith('/phone/')
}

export function getLoginPathForRoute(pathname = '') {
  return isPhoneAppPath(pathname) ? PHONE_APP_LOGIN_PATH : DESKTOP_LOGIN_PATH
}

export function getPostAuthRedirectPath(from?: RedirectLocation, fallbackPath = '/dashboard') {
  const pathname = from?.pathname

  if (!pathname?.startsWith('/') || pathname === DESKTOP_LOGIN_PATH || pathname === SETUP_PATH) {
    return fallbackPath
  }

  if (pathname === PHONE_APP_LOGIN_PATH) {
    return PHONE_APP_HOME_PATH
  }

  return `${pathname}${from?.search || ''}${from?.hash || ''}`
}

function getScreenShortSide() {
  if (typeof window === 'undefined' || !window.screen) return 0

  const width = Number(window.screen.width) || 0
  const height = Number(window.screen.height) || 0

  if (!width || !height) return 0

  return Math.min(width, height)
}

function getViewportShortSide() {
  if (typeof window === 'undefined') return 0

  const viewportWidth = window.visualViewport?.width || window.innerWidth || 0
  const viewportHeight = window.visualViewport?.height || window.innerHeight || 0

  if (!viewportWidth || !viewportHeight) return 0

  return Math.min(viewportWidth, viewportHeight)
}

export function isCellphoneDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent || ''
  const maxTouchPoints = navigator.maxTouchPoints || 0
  const screenShortSide = getScreenShortSide()
  const iPadDesktopMode = /Macintosh/i.test(userAgent)
    && maxTouchPoints > 1
    && screenShortSide >= IPAD_DESKTOP_SHORT_SIDE_LIMIT
  const tabletUserAgent = TABLET_USER_AGENT_PATTERN.test(userAgent) || iPadDesktopMode

  if (tabletUserAgent) return false

  const mobileUserAgent = PHONE_USER_AGENT_PATTERN.test(userAgent)
  const coarsePointer = window.matchMedia?.(COARSE_POINTER_QUERY).matches ?? false
  const hasTouch = maxTouchPoints > 0 || coarsePointer
  const viewportShortSide = getViewportShortSide()
  const phoneSizedScreen = screenShortSide > 0
    ? screenShortSide < PHONE_SHORT_SIDE_LIMIT
    : viewportShortSide > 0 && viewportShortSide < PHONE_SHORT_SIDE_LIMIT

  return phoneSizedScreen && (mobileUserAgent || hasTouch)
}

export function isTabletDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (isCellphoneDevice()) return false

  const userAgent = navigator.userAgent || ''
  const maxTouchPoints = navigator.maxTouchPoints || 0
  const screenShortSide = getScreenShortSide()
  const viewportShortSide = getViewportShortSide()
  const coarsePointer = window.matchMedia?.(COARSE_POINTER_QUERY).matches ?? false
  const iPadDesktopMode = /Macintosh/i.test(userAgent)
    && maxTouchPoints > 1
    && screenShortSide >= IPAD_DESKTOP_SHORT_SIDE_LIMIT
  const tabletUserAgent = TABLET_USER_AGENT_PATTERN.test(userAgent) || iPadDesktopMode
  const tabletSizedScreen = screenShortSide >= IPAD_DESKTOP_SHORT_SIDE_LIMIT
    && screenShortSide <= TABLET_SHORT_SIDE_LIMIT
    && viewportShortSide >= IPAD_DESKTOP_SHORT_SIDE_LIMIT

  return tabletUserAgent || (tabletSizedScreen && maxTouchPoints > 0 && coarsePointer)
}

export function getPortableDeviceMode(): PortableDeviceMode {
  if (isCellphoneDevice()) return 'phone'
  if (isTabletDevice()) return 'tablet'
  return 'desktop'
}

export function registerPwa() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  if (import.meta.env.DEV) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => registrations.forEach(registration => registration.unregister()))
        .catch(() => {
          // La app sigue funcionando aunque el navegador no permita limpiar el registro.
        })
    })
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // La app sigue funcionando aunque el navegador no acepte service workers.
    })
  })
}

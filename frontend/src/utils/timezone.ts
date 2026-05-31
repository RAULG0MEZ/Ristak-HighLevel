/**
 * Utilidades para manejo de zonas horarias
 *
 * IMPORTANTE:
 * - Todo se guarda en UTC en la base de datos
 * - Las campañas de Meta vienen en la zona horaria de la cuenta publicitaria
 * - Necesitamos normalizar todo a UTC antes de guardar
 * - Al mostrar, convertimos de UTC a la zona horaria del usuario
 */

/**
 * Obtiene el offset de una zona horaria en minutos
 */
function getTimezoneOffset(timezone: string, date: Date): number {
  // Crear dos fechas: una en UTC y otra en la zona horaria específica
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))

  // La diferencia es el offset
  return (utcDate.getTime() - tzDate.getTime()) / 60000
}

/**
 * Convierte una fecha UTC a la zona horaria local del usuario
 * @param utcDate Fecha en UTC
 * @param userTimezone Zona horaria del usuario (IANA format)
 * @returns Fecha en la zona horaria del usuario
 */
export function convertUTCToLocal(utcDate: string | Date, userTimezone: string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate + 'Z') : utcDate

  // Formatear en la zona horaria del usuario
  const localString = date.toLocaleString('en-US', { timeZone: userTimezone })

  return new Date(localString)
}

/**
 * Convierte una fecha local a UTC
 * @param localDate Fecha en zona horaria local
 * @param timezone Zona horaria (IANA format)
 * @returns Fecha en UTC
 */
export function convertLocalToUTC(localDate: string | Date, timezone: string): Date {
  const date = typeof localDate === 'string' ? new Date(localDate) : localDate

  // Obtener el offset de la zona horaria
  const offset = getTimezoneOffset(timezone, date)

  // Convertir a UTC restando el offset
  const utcTime = date.getTime() - (offset * 60 * 1000)

  return new Date(utcTime)
}

/**
 * Formatea una fecha UTC para mostrarla en la zona horaria del usuario
 * @param utcDate Fecha en UTC
 * @param timezone Zona horaria del usuario
 * @param format Formato deseado
 */
export function formatInTimezone(
  utcDate: string | Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate + 'Z') : utcDate

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  }

  return new Intl.DateTimeFormat('es-MX', defaultOptions).format(date)
}

/**
 * Asegura que una fecha esté en formato UTC
 */
export function ensureUTC(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toISOString()
}

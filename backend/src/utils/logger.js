const LEVELS = {
  debug: 10,
  info: 20,
  success: 20,
  warn: 30,
  error: 40,
  silent: 100
}

const configuredLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase()
const activeLevel = LEVELS[configuredLevel] ?? LEVELS.info

const SECRET_KEY_PATTERN = /(token|secret|password|authorization|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|database[_-]?url)/i

function shouldLog(level) {
  return (LEVELS[level] ?? LEVELS.info) >= activeLevel
}

function redactValue(key, value) {
  if (SECRET_KEY_PATTERN.test(String(key || ''))) {
    return '[redacted]'
  }

  if (typeof value === 'string' && /^Bearer\s+/i.test(value)) {
    return 'Bearer [redacted]'
  }

  return value
}

function sanitize(value, seen = new WeakSet(), key = '') {
  const redacted = redactValue(key, value)
  if (redacted !== value) return redacted

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    }
  }

  if (!value || typeof value !== 'object') return value

  if (seen.has(value)) return '[circular]'
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map(item => sanitize(item, seen))
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitize(redactValue(entryKey, entryValue), seen, entryKey)
    ])
  )
}

function write(level, args) {
  if (!shouldLog(level)) return

  const timestamp = new Date().toISOString()
  const label = level.toUpperCase()
  const payload = args.map(arg => sanitize(arg))
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log

  writer(`[${timestamp}] [${label}]`, ...payload)
}

export const logger = {
  info: (...args) => write('info', args),
  success: (...args) => write('success', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  debug: (...args) => write('debug', args)
}

import { db } from '../config/database.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const MANUAL_BUSINESS_EXPENSE_PERIODS = new Set(['day', 'month', 'year'])

const parseDateKeyParts = (value) => {
  const sanitized = String(value || '').includes('T')
    ? String(value || '').split('T')[0]
    : String(value || '')
  const [yearRaw, monthRaw = '01', dayRaw = '01'] = sanitized.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return { year, month, day }
}

const toUtcDayIndex = (value) => {
  const parts = parseDateKeyParts(value)
  if (!parts) return null
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY)
}

const getLastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()

export const normalizeManualBusinessExpensePeriodStart = (periodType, periodStart) => {
  const raw = String(periodStart || '').trim()

  if (periodType === 'day') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
    return raw
  }

  if (periodType === 'month') {
    const match = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
    if (!match) return null
    const month = Number(match[2])
    if (month < 1 || month > 12) return null
    return `${match[1]}-${match[2]}-01`
  }

  if (periodType === 'year') {
    const match = raw.match(/^(\d{4})(?:-\d{2}-\d{2})?$/)
    if (!match) return null
    return `${match[1]}-01-01`
  }

  return null
}

export const normalizeManualBusinessExpenseRow = (row) => ({
  period_type: row.period_type,
  period_start: row.period_start,
  amount: Number(row.amount || 0)
})

export const getManualBusinessExpenseRange = (expense) => {
  const parts = parseDateKeyParts(expense.period_start)
  if (!parts) return null

  if (expense.period_type === 'day') {
    return { from: expense.period_start, to: expense.period_start }
  }

  if (expense.period_type === 'month') {
    const month = String(parts.month).padStart(2, '0')
    const lastDay = String(getLastDayOfMonth(parts.year, parts.month)).padStart(2, '0')
    return { from: `${parts.year}-${month}-01`, to: `${parts.year}-${month}-${lastDay}` }
  }

  if (expense.period_type === 'year') {
    return { from: `${parts.year}-01-01`, to: `${parts.year}-12-31` }
  }

  return null
}

export const roundCurrencyValue = (value) => Math.round((value + Number.EPSILON) * 100) / 100

export const calculateManualBusinessExpensesForRange = (targetRange, expenses = []) => {
  const targetStart = toUtcDayIndex(targetRange?.from)
  const targetEnd = toUtcDayIndex(targetRange?.to)

  if (targetStart === null || targetEnd === null || targetEnd < targetStart) return 0

  const total = expenses.reduce((sum, expense) => {
    const amount = Number(expense.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return sum

    const sourceRange = getManualBusinessExpenseRange(expense)
    if (!sourceRange) return sum

    const sourceStart = toUtcDayIndex(sourceRange.from)
    const sourceEnd = toUtcDayIndex(sourceRange.to)
    if (sourceStart === null || sourceEnd === null || sourceEnd < sourceStart) return sum

    const overlapStart = Math.max(targetStart, sourceStart)
    const overlapEnd = Math.min(targetEnd, sourceEnd)
    if (overlapEnd < overlapStart) return sum

    const sourceDays = sourceEnd - sourceStart + 1
    const overlapDays = overlapEnd - overlapStart + 1

    return sum + (amount * overlapDays) / sourceDays
  }, 0)

  return roundCurrencyValue(total)
}

export const getManualBusinessExpensesTotalForRange = async (targetRange) => {
  if (!targetRange?.from || !targetRange?.to) return 0

  const expenses = await db.all(`
    SELECT period_type, period_start, amount
    FROM report_manual_business_expenses
  `)

  return calculateManualBusinessExpensesForRange(
    targetRange,
    expenses.map(normalizeManualBusinessExpenseRow)
  )
}

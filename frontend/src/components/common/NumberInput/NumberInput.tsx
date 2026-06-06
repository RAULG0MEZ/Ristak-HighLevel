import React, { useEffect, useMemo, useState } from 'react'

type NumberInputValue = string | number

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'defaultValue' | 'onChange'> {
  value?: NumberInputValue
  defaultValue?: NumberInputValue
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  onValueChange?: (value: number) => void
}

const toFiniteNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const sanitizeNumberDraft = (raw: string, min?: number | null) => {
  const allowNegative = min === undefined || min === null || min < 0
  let value = raw.replace(',', '.').replace(/[^\d.-]/g, '')
  const sign = allowNegative && value.startsWith('-') ? '-' : ''
  value = value.replace(/-/g, '')

  const dotIndex = value.indexOf('.')
  if (dotIndex !== -1) {
    value = `${value.slice(0, dotIndex + 1)}${value.slice(dotIndex + 1).replace(/\./g, '')}`
  }

  if (!value) return sign

  const [integerPart, decimalPart] = value.split('.')
  const normalizedInteger = integerPart.length > 1
    ? integerPart.replace(/^0+(?=\d)/, '')
    : integerPart
  const safeInteger = normalizedInteger || '0'

  return `${sign}${safeInteger}${decimalPart !== undefined ? `.${decimalPart}` : ''}`
}

const parseNumberDraft = (draft: string) => {
  if (!draft || draft === '-' || draft === '.' || draft === '-.') return null
  const parsed = Number(draft)
  return Number.isFinite(parsed) ? parsed : null
}

const formatInputValue = (value: NumberInputValue | undefined) =>
  value === undefined || value === null ? '' : String(value)

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
  onValueChange,
  onBlur,
  onFocus,
  onKeyDown,
  ...props
}) => {
  const isControlled = value !== undefined
  const minNumber = useMemo(() => toFiniteNumber(min), [min])
  const maxNumber = useMemo(() => toFiniteNumber(max), [max])
  const stepNumber = useMemo(() => toFiniteNumber(step), [step])
  const inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'] =
    minNumber !== null && minNumber < 0 || stepNumber !== null && !Number.isInteger(stepNumber)
      ? 'decimal'
      : 'numeric'
  const [draft, setDraft] = useState(() => sanitizeNumberDraft(formatInputValue(value ?? defaultValue), minNumber))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (isControlled && !editing) {
      setDraft(sanitizeNumberDraft(formatInputValue(value), minNumber))
    }
  }, [editing, isControlled, minNumber, value])

  const clampValue = (nextValue: number) => {
    let clamped = nextValue
    if (minNumber !== null) clamped = Math.max(minNumber, clamped)
    if (maxNumber !== null) clamped = Math.min(maxNumber, clamped)
    return clamped
  }

  return (
    <input
      {...props}
      type="text"
      inputMode={inputMode}
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={(event) => {
        setEditing(true)
        onFocus?.(event)
      }}
      onChange={(event) => {
        const nextDraft = sanitizeNumberDraft(event.currentTarget.value, minNumber)
        event.currentTarget.value = nextDraft
        setDraft(nextDraft)
        onChange?.(event)

        const parsed = parseNumberDraft(nextDraft)
        if (parsed !== null) onValueChange?.(clampValue(parsed))
      }}
      onBlur={(event) => {
        const parsed = parseNumberDraft(draft)
        if (parsed !== null) {
          const clamped = clampValue(parsed)
          const nextDraft = String(clamped)
          setDraft(nextDraft)
          onValueChange?.(clamped)
          event.currentTarget.value = nextDraft
        } else {
          setDraft(isControlled ? formatInputValue(value) : sanitizeNumberDraft(formatInputValue(defaultValue), minNumber))
        }

        setEditing(false)
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
        onKeyDown?.(event)
      }}
    />
  )
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ChevronLeft } from 'lucide-react'
import styles from './PhoneSelect.module.css'

export interface PhoneSelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface PhoneSelectProps {
  options: PhoneSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  title?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  buttonClassName?: string
  sheetClassName?: string
  ariaLabel?: string
}

export const PhoneSelect: React.FC<PhoneSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Selecciona una opción',
  title = 'Selecciona',
  disabled = false,
  invalid = false,
  className = '',
  buttonClassName = '',
  sheetClassName = '',
  ariaLabel
}) => {
  const [open, setOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleSelect = (option: PhoneSelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  const sheet = open ? (
    <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${sheetClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <button type="button" className={styles.backButton} onClick={() => setOpen(false)} aria-label="Volver">
            <ChevronLeft size={22} />
          </button>
          <strong>{title}</strong>
        </div>
        <div className={styles.options} role="listbox" aria-label={title}>
          {options.map((option) => {
            const selected = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onClick={() => handleSelect(option)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                {selected && <Check size={18} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className={`${styles.host} ${className}`}>
      <button
        type="button"
        className={`${styles.trigger} ${invalid ? styles.invalid : ''} ${buttonClassName}`}
        disabled={disabled}
        aria-label={ariaLabel || title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(true)}
      >
        <span className={selectedOption ? styles.value : styles.placeholder}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </div>
  )
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { CustomSelect } from '@/components/common'
import automationsService, { type AutomationSummary } from '@/services/automationsService'
import {
  CONTACT_VARIABLES,
  validateNodeConfig,
  type ConfigField,
  type NodeDefinition
} from './nodeRegistry'
import { genId } from './flowUtils'
import styles from './AutomationEditor.module.css'

type ConfigValue = Record<string, unknown>

interface NodeConfigBubbleProps {
  definition: NodeDefinition
  config: ConfigValue
  anchor: { x: number; y: number }
  bounds: { width: number; height: number }
  /** Para "Iniciar Automatización": no ofrecer la automatización actual */
  excludeAutomationId?: string
  onChange: (config: ConfigValue) => void
  onClose: () => void
}

const BUBBLE_WIDTH = 320

const str = (value: unknown): string => (typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value))

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'es igual a' },
  { value: 'not_equals', label: 'no es igual a' },
  { value: 'contains', label: 'contiene' },
  { value: 'not_contains', label: 'no contiene' },
  { value: 'greater', label: 'es mayor que' },
  { value: 'less', label: 'es menor que' },
  { value: 'empty', label: 'está vacío' },
  { value: 'not_empty', label: 'no está vacío' }
]

const DURATION_UNIT_OPTIONS = [
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Días' }
]

export const NodeConfigBubble: React.FC<NodeConfigBubbleProps> = ({
  definition,
  config,
  anchor,
  bounds,
  excludeAutomationId,
  onChange,
  onClose
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [automationOptions, setAutomationOptions] = useState<AutomationSummary[] | null>(null)

  const errors = useMemo(() => validateNodeConfig(definition, config), [definition, config])

  const setValue = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value })
  }

  // Cerrar con clic fuera
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [onClose])

  // Genera la URL del webhook entrante la primera vez que se abre
  const needsEndpoint = definition.fields.some((field) => field.type === 'webhookUrl') && !str(config.endpointId)
  useEffect(() => {
    if (needsEndpoint) {
      setValue('endpointId', genId('hook'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsEndpoint])

  // Carga las automatizaciones para el selector "Iniciar Automatización"
  const needsAutomations = definition.fields.some((field) => field.type === 'automation')
  useEffect(() => {
    if (!needsAutomations) return
    let cancelled = false
    automationsService
      .getOverview()
      .then((overview) => {
        if (!cancelled) {
          setAutomationOptions(
            overview.automations.filter((automation) => automation.id !== excludeAutomationId)
          )
        }
      })
      .catch(() => {
        if (!cancelled) setAutomationOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [needsAutomations, excludeAutomationId])

  const appendVariable = (key: string, variable: string) => {
    const current = str(config[key])
    setValue(key, current ? `${current} ${variable}` : variable)
  }

  const renderVariables = (field: ConfigField) =>
    field.showVariables ? (
      <div className={styles.variableChips}>
        {CONTACT_VARIABLES.map((variable) => (
          <button
            key={variable}
            type="button"
            className={styles.variableChip}
            title={`Insertar ${variable}`}
            onClick={() => appendVariable(field.key, variable)}
          >
            {variable}
          </button>
        ))}
      </div>
    ) : null

  const renderField = (field: ConfigField) => {
    if (field.showIf && !field.showIf(config)) return null

    switch (field.type) {
      case 'text':
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            <input
              className={styles.configInput}
              value={str(config[field.key])}
              placeholder={field.placeholder}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
            {renderVariables(field)}
            {field.help && <span className={styles.configHelp}>{field.help}</span>}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            <textarea
              className={styles.configTextarea}
              value={str(config[field.key])}
              placeholder={field.placeholder}
              rows={4}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
            {renderVariables(field)}
            {field.help && <span className={styles.configHelp}>{field.help}</span>}
          </div>
        )

      case 'number':
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            <input
              className={styles.configInput}
              type="number"
              value={config[field.key] === undefined || config[field.key] === '' ? '' : Number(config[field.key])}
              placeholder={field.placeholder}
              onChange={(event) =>
                setValue(field.key, event.target.value === '' ? '' : Number(event.target.value))
              }
            />
          </div>
        )

      case 'select':
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            <CustomSelect
              options={field.options || []}
              value={str(config[field.key])}
              onValueChange={(value) => setValue(field.key, value)}
              placeholder="Selecciona una opción"
              aria-label={field.label}
            />
          </div>
        )

      case 'toggle': {
        const enabled = Boolean(config[field.key])
        return (
          <div key={field.key} className={cn(styles.configField, styles.toggleField)}>
            <label className={styles.configLabel}>{field.label}</label>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              className={cn(styles.toggleSwitch, enabled && styles.toggleSwitchOn)}
              onClick={() => setValue(field.key, !enabled)}
            />
          </div>
        )
      }

      case 'datetime':
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            <input
              className={styles.configInput}
              type="datetime-local"
              value={str(config[field.key])}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
          </div>
        )

      case 'duration': {
        const amount = Number(config.amount) || 0
        const unit = str(config.unit) || 'hours'
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            <div className={styles.configRow}>
              <input
                className={cn(styles.configInput, styles.configRowGrow)}
                type="number"
                min={0}
                value={amount}
                onChange={(event) => setValue('amount', Number(event.target.value))}
              />
              <div className={styles.configRowGrow}>
                <CustomSelect
                  options={DURATION_UNIT_OPTIONS}
                  value={unit}
                  onValueChange={(value) => setValue('unit', value)}
                  aria-label="Unidad de tiempo"
                />
              </div>
            </div>
          </div>
        )
      }

      case 'keywords': {
        const keywords = Array.isArray(config[field.key]) ? (config[field.key] as string[]) : []
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            {keywords.length > 0 && (
              <div className={styles.keywordChips}>
                {keywords.map((keyword) => (
                  <span key={keyword} className={styles.keywordChip}>
                    {keyword}
                    <button
                      type="button"
                      className={styles.keywordChipRemove}
                      title="Quitar palabra"
                      onClick={() => setValue(field.key, keywords.filter((value) => value !== keyword))}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              className={styles.configInput}
              placeholder={field.placeholder || 'Escribe y presiona Enter'}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                const value = (event.target as HTMLInputElement).value.trim()
                if (value && !keywords.includes(value)) {
                  setValue(field.key, [...keywords, value])
                }
                ;(event.target as HTMLInputElement).value = ''
              }}
            />
          </div>
        )
      }

      case 'keyValue': {
        const rows = Array.isArray(config[field.key])
          ? (config[field.key] as Array<{ key?: string; value?: string }>)
          : []
        const updateRow = (index: number, patch: { key?: string; value?: string }) => {
          const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
          setValue(field.key, next)
        }
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            {rows.map((row, index) => (
              <div key={index} className={styles.configRow}>
                <input
                  className={cn(styles.configInput, styles.configRowGrow)}
                  placeholder="Header"
                  value={str(row.key)}
                  onChange={(event) => updateRow(index, { key: event.target.value })}
                />
                <input
                  className={cn(styles.configInput, styles.configRowGrow)}
                  placeholder="Valor"
                  value={str(row.value)}
                  onChange={(event) => updateRow(index, { value: event.target.value })}
                />
                <button
                  type="button"
                  className={styles.configIconButton}
                  title="Quitar"
                  onClick={() => setValue(field.key, rows.filter((_, rowIndex) => rowIndex !== index))}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.configSmallButton}
              onClick={() => setValue(field.key, [...rows, { key: '', value: '' }])}
            >
              <Plus size={11} />
              Agregar header
            </button>
          </div>
        )
      }

      case 'conditions': {
        const rows = Array.isArray(config[field.key])
          ? (config[field.key] as Array<{ field?: string; operator?: string; value?: string }>)
          : []
        const updateRow = (index: number, patch: Record<string, string>) => {
          const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
          setValue(field.key, next)
        }
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            {rows.map((row, index) => {
              const noValue = row.operator === 'empty' || row.operator === 'not_empty'
              return (
                <div key={index} className={styles.configField} style={{ marginBottom: 6 }}>
                  <div className={styles.configRow}>
                    <input
                      className={cn(styles.configInput, styles.configRowGrow)}
                      placeholder="Campo (ej. etapa)"
                      value={str(row.field)}
                      onChange={(event) => updateRow(index, { field: event.target.value })}
                    />
                    <button
                      type="button"
                      className={styles.configIconButton}
                      title="Quitar condición"
                      onClick={() => setValue(field.key, rows.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className={styles.configRow}>
                    <div className={styles.configRowGrow}>
                      <CustomSelect
                        options={CONDITION_OPERATORS}
                        value={str(row.operator) || 'equals'}
                        onValueChange={(value) => updateRow(index, { operator: value })}
                        aria-label="Operador"
                      />
                    </div>
                    {!noValue && (
                      <input
                        className={cn(styles.configInput, styles.configRowGrow)}
                        placeholder="Valor"
                        value={str(row.value)}
                        onChange={(event) => updateRow(index, { value: event.target.value })}
                      />
                    )}
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              className={styles.configSmallButton}
              onClick={() =>
                setValue(field.key, [...rows, { field: '', operator: 'equals', value: '' }])
              }
            >
              <Plus size={11} />
              Agregar condición
            </button>
          </div>
        )
      }

      case 'percentBranches':
      case 'branches': {
        const withPercent = field.type === 'percentBranches'
        const rows = Array.isArray(config[field.key])
          ? (config[field.key] as Array<{ id?: string; label?: string; percent?: number }>)
          : []
        const total = rows.reduce((sum, row) => sum + (Number(row.percent) || 0), 0)
        const updateRow = (index: number, patch: Record<string, unknown>) => {
          const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
          setValue(field.key, next)
        }
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            {rows.map((row, index) => (
              <div key={row.id || index} className={styles.configRow}>
                <input
                  className={cn(styles.configInput, styles.configRowGrow)}
                  placeholder={`Rama ${index + 1}`}
                  value={str(row.label)}
                  onChange={(event) => updateRow(index, { label: event.target.value })}
                />
                {withPercent && (
                  <input
                    className={styles.configInput}
                    style={{ width: 72 }}
                    type="number"
                    min={0}
                    max={100}
                    value={Number(row.percent) || 0}
                    onChange={(event) => updateRow(index, { percent: Number(event.target.value) })}
                  />
                )}
                <button
                  type="button"
                  className={styles.configIconButton}
                  title="Quitar rama"
                  disabled={rows.length <= 2}
                  style={rows.length <= 2 ? { opacity: 0.35, cursor: 'default' } : undefined}
                  onClick={() => {
                    if (rows.length <= 2) return
                    setValue(field.key, rows.filter((_, rowIndex) => rowIndex !== index))
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <div className={styles.configRow} style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className={styles.configSmallButton}
                onClick={() =>
                  setValue(field.key, [
                    ...rows,
                    withPercent
                      ? { id: genId('branch'), label: String.fromCharCode(65 + rows.length), percent: 0 }
                      : { id: genId('branch'), label: `Rama ${rows.length + 1}` }
                  ])
                }
              >
                <Plus size={11} />
                Agregar rama
              </button>
              {withPercent && (
                <span className={cn(styles.percentTotal, total !== 100 && styles.percentTotalError)}>
                  Total: {total}%
                </span>
              )}
            </div>
          </div>
        )
      }

      case 'webhookUrl': {
        const endpointId = str(config.endpointId)
        const url = endpointId ? `${window.location.origin}/webhook/automations/${endpointId}` : 'Generando URL…'
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            <div className={styles.webhookUrlBox}>
              <span className={styles.webhookUrlText} title={url}>{url}</span>
              <button
                type="button"
                className={styles.configIconButton}
                style={{ color: copied ? 'var(--color-status-success)' : undefined }}
                title="Copiar URL"
                onClick={() => {
                  void navigator.clipboard?.writeText(url).then(() => {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1600)
                  })
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <span className={styles.configHelp}>
              Envía una llamada HTTP a esta URL para iniciar la automatización.
            </span>
          </div>
        )
      }

      case 'automation': {
        const options = (automationOptions || []).map((automation) => ({
          value: automation.id,
          label: automation.name
        }))
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            {automationOptions === null ? (
              <span className={styles.configHelp}>Cargando automatizaciones…</span>
            ) : options.length === 0 ? (
              <span className={styles.configHelp}>No hay otras automatizaciones todavía.</span>
            ) : (
              <CustomSelect
                options={options}
                value={str(config.automationId)}
                onValueChange={(value) => {
                  const selected = automationOptions?.find((automation) => automation.id === value)
                  onChange({ ...config, automationId: value, automationName: selected?.name || '' })
                }}
                placeholder="Selecciona una automatización"
                aria-label={field.label}
              />
            )}
          </div>
        )
      }

      case 'info':
        return (
          <div key={field.key} className={styles.configField}>
            <label className={styles.configLabel}>{field.label}</label>
            <pre className={styles.configInfo}>{field.text}</pre>
          </div>
        )

      default:
        return null
    }
  }

  const left = Math.max(12, Math.min(anchor.x, bounds.width - BUBBLE_WIDTH - 12))
  const top = Math.max(12, Math.min(anchor.y, bounds.height - 220))

  return (
    <div
      ref={rootRef}
      className={styles.bubble}
      style={{ left, top }}
      role="dialog"
      aria-label={`Configurar ${definition.label}`}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className={styles.bubbleHeader}>
        <span className={styles.pickerItemIcon} data-accent={definition.accent}>
          <definition.icon size={14} />
        </span>
        <div className={styles.bubbleTitle}>
          {definition.label}
          {definition.description && (
            <div className={styles.bubbleSubtitle}>{definition.description}</div>
          )}
        </div>
        <button type="button" className={styles.bubbleClose} onClick={onClose} title="Cerrar (Esc)">
          <X size={14} />
        </button>
      </div>

      <div className={styles.bubbleBody}>
        {errors.length > 0 && (
          <div className={styles.configErrors}>
            {errors.map((error) => (
              <span key={error} className={styles.configErrorLine}>
                {error}
              </span>
            ))}
          </div>
        )}
        {definition.fields.length === 0 && (
          <p className={styles.configHelp}>Este paso no necesita configuración.</p>
        )}
        {definition.fields.map(renderField)}
      </div>
    </div>
  )
}

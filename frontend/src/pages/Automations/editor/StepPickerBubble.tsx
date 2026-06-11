import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Crown, Link2, Play, Search, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  getCategoriesForKind,
  getDefinitionsByKind,
  type NodeDefinition,
  type NodeKind
} from './nodeRegistry'
import styles from './AutomationEditor.module.css'

const RECENT_STEPS_KEY = 'ristak.automations.recentSteps'
const RECENT_LIMIT = 5

export function readRecentSteps(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STEPS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []
  } catch {
    return []
  }
}

export function rememberRecentStep(type: string) {
  try {
    const next = [type, ...readRecentSteps().filter((value) => value !== type)].slice(0, RECENT_LIMIT)
    window.localStorage.setItem(RECENT_STEPS_KEY, JSON.stringify(next))
  } catch {
    // almacenamiento no disponible: los recientes simplemente no se guardan
  }
}

export interface StepPickerAnchor {
  /** Posición en píxeles relativa al contenedor del editor */
  x: number
  y: number
}

interface StepPickerBubbleProps {
  kind: NodeKind
  anchor: StepPickerAnchor
  /** Tamaño del contenedor para no salirse de la pantalla */
  bounds: { width: number; height: number }
  title?: string
  /** Opción "conectar automáticamente" (cuando aplica) */
  connectLabel?: string
  connectEnabled?: boolean
  onToggleConnect?: (enabled: boolean) => void
  /** Muestra la sección "Paso inicial" para añadir un disparador */
  showStartStep?: boolean
  onSelectStartStep?: () => void
  onSelect: (definition: NodeDefinition) => void
  onClose: () => void
}

interface PickerSection {
  id: string
  label: string
  items: NodeDefinition[]
}

const BUBBLE_WIDTH = 320
const BUBBLE_MAX_HEIGHT = 480

export const StepPickerBubble: React.FC<StepPickerBubbleProps> = ({
  kind,
  anchor,
  bounds,
  title,
  connectLabel,
  connectEnabled,
  onToggleConnect,
  showStartStep,
  onSelectStartStep,
  onSelect,
  onClose
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const sections = useMemo<PickerSection[]>(() => {
    const definitions = getDefinitionsByKind(kind)
    const normalizedQuery = query.trim().toLowerCase()
    const matches = (definition: NodeDefinition) =>
      !normalizedQuery ||
      definition.label.toLowerCase().includes(normalizedQuery) ||
      (definition.description || '').toLowerCase().includes(normalizedQuery) ||
      (definition.brand || '').toLowerCase().includes(normalizedQuery)

    const result: PickerSection[] = []

    const recents = readRecentSteps()
      .map((type) => definitions.find((definition) => definition.type === type))
      .filter((definition): definition is NodeDefinition => Boolean(definition))
      .filter(matches)

    if (recents.length > 0) {
      result.push({
        id: 'recent',
        label: kind === 'trigger' ? 'Disparadores recientes' : 'Recientes',
        items: recents
      })
    }

    getCategoriesForKind(kind).forEach((category) => {
      const items = definitions
        .filter((definition) => definition.category === category.id)
        .filter(matches)
      if (items.length > 0) {
        result.push({ id: category.id, label: category.label, items })
      }
    })

    return result
  }, [kind, query])

  const flatItems = useMemo(
    () => sections.flatMap((section) => section.items.map((item) => ({ section: section.id, item }))),
    [sections]
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [query, kind])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

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

  // Mantener visible el elemento activo al navegar con teclado
  useEffect(() => {
    rootRef.current
      ?.querySelector(`[data-picker-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(flatItems.length - 1, index + 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, index - 1))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const active = flatItems[activeIndex]
      if (active) onSelect(active.item)
    }
  }

  // Posicionamiento: cerca del ancla, sin salirse del contenedor
  const left = Math.max(12, Math.min(anchor.x, bounds.width - BUBBLE_WIDTH - 12))
  const top = Math.max(12, Math.min(anchor.y, bounds.height - Math.min(BUBBLE_MAX_HEIGHT, bounds.height - 24) - 12))

  let runningIndex = -1

  return (
    <div
      ref={rootRef}
      className={styles.bubble}
      style={{ left, top }}
      role="dialog"
      aria-label={title || 'Elegir paso'}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className={styles.bubbleHeader}>
        <Search size={14} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
        <input
          ref={searchRef}
          className={styles.bubbleSearch}
          placeholder={kind === 'trigger' ? 'Buscar disparador…' : 'Buscar paso…'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar paso"
        />
        <button type="button" className={styles.bubbleClose} onClick={onClose} title="Cerrar (Esc)">
          <X size={14} />
        </button>
      </div>

      <div className={styles.bubbleBody}>
        {showStartStep && onSelectStartStep && !query && (
          <div className={styles.pickerSection} style={{ marginTop: 0 }}>
            <div className={styles.pickerSectionTitle}>Paso inicial</div>
            <button
              type="button"
              data-accent="green"
              className={styles.pickerItem}
              onClick={onSelectStartStep}
            >
              <span className={styles.pickerItemIcon}>
                <Play size={14} />
              </span>
              <span className={styles.pickerItemLabel}>
                Disparador
                <span className={styles.pickerItemDescription}>
                  Añade un evento que inicia la automatización
                </span>
              </span>
              <ChevronRight size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            </button>
          </div>
        )}
        {sections.length === 0 && (
          <p className={styles.pickerEmpty}>No hay pasos que coincidan con "{query}"</p>
        )}
        {sections.map((section) => (
          <div key={section.id} className={styles.pickerSection}>
            <div className={styles.pickerSectionTitle}>{section.label}</div>
            {section.items.map((definition) => {
              runningIndex += 1
              const index = runningIndex
              return (
                <button
                  key={`${section.id}-${definition.type}`}
                  type="button"
                  data-picker-index={index}
                  data-accent={definition.accent}
                  className={cn(styles.pickerItem, index === activeIndex && styles.pickerItemActive)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onSelect(definition)}
                >
                  <span className={styles.pickerItemIcon}>
                    <definition.icon size={14} />
                  </span>
                  <span className={styles.pickerItemLabel}>
                    {definition.label}
                    {definition.description && (
                      <span className={styles.pickerItemDescription}>{definition.description}</span>
                    )}
                  </span>
                  {definition.pro && (
                    <span className={styles.proBadge}>
                      <Crown size={9} />
                      PRO
                    </span>
                  )}
                  <ChevronRight size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {connectLabel && onToggleConnect && (
        <label className={styles.bubbleFooter} style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(connectEnabled)}
            onChange={(event) => onToggleConnect(event.target.checked)}
          />
          <Link2 size={13} style={{ color: 'var(--color-text-tertiary)' }} />
          {connectLabel}
        </label>
      )}
    </div>
  )
}

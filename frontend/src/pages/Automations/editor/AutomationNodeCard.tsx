import React, { useLayoutEffect, useRef } from 'react'
import { AlertCircle, Copy, Plus, Trash2, X, Zap } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { AutomationNode } from '@/services/automationsService'
import { getNodeDefinition, validateNodeConfig, type NodeDefinition } from './nodeRegistry'
import { getNodeOutputs, getStartTriggers, isStartNode, nodeHasInput } from './flowUtils'
import styles from './AutomationEditor.module.css'

/** Posiciones locales (en px del nodo) de los conectores, para dibujar flechas */
export interface NodeHandleLayout {
  width: number
  height: number
  inputY: number
  outputs: Record<string, number>
}

interface AutomationNodeCardProps {
  node: AutomationNode
  selected: boolean
  dragging: boolean
  errors?: string[]
  /** Estado durante el arrastre de una conexión */
  dropState?: 'target' | 'forbidden' | null
  connectedOutputs: Set<string>
  zoom: number
  onMeasure: (nodeId: string, layout: NodeHandleLayout) => void
  onPointerDownHeader: (event: React.PointerEvent, node: AutomationNode) => void
  onSelect: (node: AutomationNode) => void
  onOpenConfig: (node: AutomationNode) => void
  onDuplicate: (node: AutomationNode) => void
  onDelete: (node: AutomationNode) => void
  onStartConnection: (event: React.PointerEvent, node: AutomationNode, handleId: string) => void
  onAddTrigger: (node: AutomationNode, anchorRect: DOMRect) => void
  onEditTrigger: (node: AutomationNode, triggerId: string, anchorRect: DOMRect) => void
  onRemoveTrigger: (node: AutomationNode, triggerId: string) => void
}

function triggerSummary(definition: NodeDefinition | undefined, config: Record<string, unknown>): string {
  if (!definition) return 'Tipo desconocido'
  const summary = definition.summary(config || {})
  return summary.text || summary.box || definition.description || ''
}

export const AutomationNodeCard: React.FC<AutomationNodeCardProps> = ({
  node,
  selected,
  dragging,
  errors,
  dropState,
  connectedOutputs,
  zoom,
  onMeasure,
  onPointerDownHeader,
  onSelect,
  onOpenConfig,
  onDuplicate,
  onDelete,
  onStartConnection,
  onAddTrigger,
  onEditTrigger,
  onRemoveTrigger
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const isStart = isStartNode(node)
  const definition = isStart ? undefined : getNodeDefinition(node.type)
  const outputs = getNodeOutputs(node)
  const hasInput = nodeHasInput(node)
  const triggers = isStart ? getStartTriggers(node) : []

  // Reporta la posición de cada conector relativa a la tarjeta (independiente
  // del zoom) para que el canvas pueda dibujar las flechas con precisión.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const rootRect = root.getBoundingClientRect()
    const safeZoom = zoom || 1
    const layout: NodeHandleLayout = {
      width: rootRect.width / safeZoom,
      height: rootRect.height / safeZoom,
      inputY: 24,
      outputs: {}
    }

    const inputEl = root.querySelector<HTMLElement>('[data-handle-in]')
    if (inputEl) {
      const rect = inputEl.getBoundingClientRect()
      layout.inputY = (rect.top - rootRect.top + rect.height / 2) / safeZoom
    }

    root.querySelectorAll<HTMLElement>('[data-handle-out]').forEach((handleEl) => {
      const handleId = handleEl.dataset.handleOut as string
      const rect = handleEl.getBoundingClientRect()
      layout.outputs[handleId] = (rect.top - rootRect.top + rect.height / 2) / safeZoom
    })

    onMeasure(node.id, layout)
  })

  const accent = isStart ? 'blue' : definition?.accent || 'blue'
  const Icon = isStart ? Zap : definition?.icon || Zap
  const summary = !isStart && definition ? definition.summary(node.config || {}) : undefined
  const hasErrors = Boolean(errors && errors.length > 0)

  return (
    <div
      ref={rootRef}
      data-automation-node={node.id}
      data-accent={accent}
      className={cn(
        styles.node,
        isStart && styles.startCard,
        selected && styles.nodeSelected,
        hasErrors && styles.nodeError,
        dragging && styles.nodeDragging,
        dropState === 'target' && styles.nodeDropTarget,
        dropState === 'forbidden' && styles.nodeDropForbidden
      )}
      style={{ left: node.position.x, top: node.position.y }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect(node)
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (!isStart) onOpenConfig(node)
      }}
    >
      {/* Conector de entrada */}
      {hasInput && (
        <span
          data-handle-in
          className={cn(styles.handle, styles.handleIn)}
          title="Entrada"
        />
      )}

      {/* Encabezado */}
      <div
        className={cn(styles.nodeHeader, definition?.tintedHeader && styles.nodeHeaderTinted)}
        onPointerDown={(event) => onPointerDownHeader(event, node)}
      >
        <span className={styles.nodeHeaderIcon}>
          <Icon size={15} />
        </span>
        <span className={styles.nodeHeaderText}>
          {!isStart && definition?.brand && <span className={styles.nodeBrand}>{definition.brand}</span>}
          <span className={styles.nodeTitle}>{isStart ? 'Cuando...' : definition?.label || node.label || node.type}</span>
        </span>
        {!isStart && (
          <span className={styles.nodeQuickActions}>
            <button
              type="button"
              className={styles.nodeQuickButton}
              title="Duplicar paso"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onDuplicate(node)
              }}
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              className={cn(styles.nodeQuickButton, styles.nodeQuickButtonDanger)}
              title="Eliminar paso"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onDelete(node)
              }}
            >
              <Trash2 size={13} />
            </button>
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div className={styles.nodeBody}>
        {isStart ? (
          <>
            {triggers.length === 0 && (
              <p className={styles.startIntro}>
                Un disparador es un evento que inicia tu Automatización. Haz clic para añadir un
                disparador.
              </p>
            )}
            {triggers.map((trigger) => {
              const triggerDefinition = getNodeDefinition(trigger.type)
              const TriggerIcon = triggerDefinition?.icon || Zap
              const triggerErrors = triggerDefinition
                ? validateNodeConfig(triggerDefinition, trigger.config || {})
                : ['Tipo desconocido']
              return (
                <button
                  key={trigger.id}
                  type="button"
                  data-accent={triggerDefinition?.accent || 'green'}
                  className={cn(styles.triggerChip, triggerErrors.length > 0 && styles.triggerChipError)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onEditTrigger(node, trigger.id, event.currentTarget.getBoundingClientRect())
                  }}
                >
                  <span className={styles.triggerChipIcon}>
                    <TriggerIcon size={13} />
                  </span>
                  <span className={styles.triggerChipText}>
                    <span className={styles.triggerChipTitle}>{triggerDefinition?.label || trigger.type}</span>
                    <span className={styles.triggerChipDetail}>
                      {triggerErrors.length > 0
                        ? 'Falta configurar'
                        : triggerSummary(triggerDefinition, trigger.config)}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    className={styles.triggerChipRemove}
                    title="Quitar disparador"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemoveTrigger(node, trigger.id)
                    }}
                  >
                    <X size={11} />
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              className={styles.addTriggerButton}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onAddTrigger(node, event.currentTarget.getBoundingClientRect())
              }}
            >
              <Plus size={13} />
              Nuevo disparador
            </button>
          </>
        ) : (
          <>
            {summary?.text && <p className={styles.nodeSummaryText}>{summary.text}</p>}
            {summary?.box && <div className={styles.nodeSummaryBox}>{summary.box}</div>}
            {!summary?.text && !summary?.box && (
              <p className={styles.nodeEmpty}>{summary?.empty || 'Toca un paso para editar'}</p>
            )}
            {hasErrors && (
              <span className={styles.nodeErrorHint}>
                <AlertCircle size={12} />
                {errors?.[0]}
              </span>
            )}
          </>
        )}
      </div>

      {/* Salidas (Entonces / Siguiente paso / ramas) */}
      {outputs.length > 0 && (
        <div className={styles.nodeOutputs}>
          {outputs.map((output) => (
            <div key={output.id} className={styles.nodeOutputRow}>
              <span className={styles.nodeOutputLabel}>{output.label || 'Siguiente paso'}</span>
              <span
                data-handle-out={output.id}
                className={cn(
                  styles.handle,
                  styles.handleOut,
                  connectedOutputs.has(output.id) && styles.handleConnected
                )}
                title="Arrastra para conectar o haz clic para elegir el siguiente paso"
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                  onStartConnection(event, node, output.id)
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

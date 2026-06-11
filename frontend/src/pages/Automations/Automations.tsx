import React, { Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AutomationsHome } from './AutomationsHome'

// El editor (canvas, registro de nodos, composer…) es el grafo más pesado del
// módulo: se carga en su propio chunk para que /automations abra al instante.
const AutomationEditor = React.lazy(() =>
  import('./editor/AutomationEditor').then((module) => ({ default: module.AutomationEditor }))
)

const editorPreload = () => import('./editor/AutomationEditor')

export const Automations: React.FC = () => {
  // Precarga el chunk del editor en segundo plano: al entrar a una
  // automatización ya está listo (sin espera perceptible)
  useEffect(() => {
    const timer = window.setTimeout(() => void editorPreload(), 300)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Routes>
      <Route index element={<AutomationsHome />} />
      <Route
        path=":automationId"
        element={
          <Suspense
            fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 8, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                <Loader2 size={15} className="animate-spin" />
              </div>
            }
          >
            <AutomationEditor />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/automations" replace />} />
    </Routes>
  )
}

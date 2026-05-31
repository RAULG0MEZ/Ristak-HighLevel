import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, ExternalLink, Server, Terminal } from 'lucide-react'
import { Card } from '@/components/common'
import { useNotification } from '@/contexts/NotificationContext'
import styles from './Settings.module.css'

const API_URL = import.meta.env.VITE_API_URL || ''
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

interface OpenApiParameter {
  name: string
  in: string
  required?: boolean
  schema?: {
    type?: string
    format?: string
    enum?: string[]
  }
}

interface OpenApiOperation {
  operationId?: string
  summary?: string
  parameters?: OpenApiParameter[]
}

interface OpenApiSpec {
  info?: {
    title?: string
    version?: string
    description?: string
  }
  paths?: Record<string, Partial<Record<typeof HTTP_METHODS[number], OpenApiOperation>>>
}

interface ApiOperation extends OpenApiOperation {
  method: string
  path: string
}

export const APIDocumentation: React.FC = () => {
  const { showToast } = useNotification()
  const [spec, setSpec] = useState<OpenApiSpec | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const origin = API_URL || window.location.origin
  const docsUrl = `${window.location.origin}/settings/api-docs`
  const externalApiBaseUrl = `${origin}/api/external`
  const openApiUrl = `${externalApiBaseUrl}/openapi.json`
  const mcpServerUrl = `${origin}/api/mcp`

  const operations = useMemo<ApiOperation[]>(() => {
    if (!spec?.paths) return []

    return Object.entries(spec.paths).flatMap(([path, pathItem]) =>
      HTTP_METHODS.flatMap((method) => {
        const operation = pathItem?.[method]
        return operation ? [{ ...operation, method: method.toUpperCase(), path }] : []
      })
    )
  }, [spec])

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      showToast('success', 'Copiado', `${label} copiado al portapapeles`)
    } catch {
      showToast('error', 'Error', `No se pudo copiar ${label}`)
    }
  }

  useEffect(() => {
    let active = true

    const loadSpec = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const response = await fetch(openApiUrl)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || 'No se pudo cargar OpenAPI')
        }

        if (active) setSpec(data)
      } catch (error: any) {
        if (active) setLoadError(error.message || 'No se pudo cargar la documentación')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadSpec()

    return () => {
      active = false
    }
  }, [openApiUrl])

  return (
    <div className={styles.settingsContent}>
      <div className={styles.settingsSection}>
        <Link
          to="/settings/api-access"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginBottom: '1rem'
          }}
        >
          <ArrowLeft size={16} />
          Acceso API
        </Link>

        <h2 className={styles.sectionTitle}>Documentación API</h2>
        <p className={styles.sectionDescription}>
          Referencia para conectar sistemas externos a Ristak por REST o MCP.
        </p>

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
          <Card variant="glass" padding="lg">
            <SectionTitle icon={<Server size={18} />} title="Direcciones" />
            <div style={{ display: 'grid', gap: '0.875rem' }}>
              <ReadonlyField label="Documentación" value={docsUrl} onCopy={() => copyText(docsUrl, 'documentación API')} />
              <ReadonlyField label="REST API base" value={externalApiBaseUrl} onCopy={() => copyText(externalApiBaseUrl, 'REST API base')} />
              <ReadonlyField label="OpenAPI JSON" value={openApiUrl} onCopy={() => copyText(openApiUrl, 'OpenAPI JSON')} external />
              <ReadonlyField label="MCP server" value={mcpServerUrl} onCopy={() => copyText(mcpServerUrl, 'MCP server')} />
            </div>
          </Card>

          <Card variant="glass" padding="lg">
            <SectionTitle icon={<Terminal size={18} />} title="Autenticación" />
            <div style={{ display: 'grid', gap: '1rem' }}>
              <CodeBlock
                label="REST"
                value={`Authorization: Bearer <RISTAK_API_TOKEN>`}
                onCopy={() => copyText('Authorization: Bearer <RISTAK_API_TOKEN>', 'header REST')}
              />
              <CodeBlock
                label="Ejemplo REST"
                value={`curl -H "Authorization: Bearer <RISTAK_API_TOKEN>" "${externalApiBaseUrl}/me"`}
                onCopy={() => copyText(`curl -H "Authorization: Bearer <RISTAK_API_TOKEN>" "${externalApiBaseUrl}/me"`, 'ejemplo REST')}
              />
              <CodeBlock
                label="MCP discovery"
                value={`POST ${mcpServerUrl}
Authorization: Bearer <OAUTH_ACCESS_TOKEN>
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`}
                onCopy={() => copyText(`POST ${mcpServerUrl}
Authorization: Bearer <OAUTH_ACCESS_TOKEN>
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`, 'ejemplo MCP')}
              />
              <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: '0.875rem', lineHeight: 1.55 }}>
                REST usa el API token de Ristak. MCP usa OAuth: el cliente descubre la configuración desde el servidor MCP y el usuario autoriza con su API token.
              </p>
            </div>
          </Card>

          <Card variant="glass" padding="lg">
            <SectionTitle icon={<ExternalLink size={18} />} title="REST endpoints" />
            {isLoading && (
              <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                Cargando documentación...
              </p>
            )}

            {!isLoading && loadError && (
              <p style={{ margin: 0, color: 'var(--color-status-error)', fontSize: '0.875rem' }}>
                {loadError}
              </p>
            )}

            {!isLoading && !loadError && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: '0.875rem', lineHeight: 1.55 }}>
                  Esta lista sale directo del schema OpenAPI publicado por el backend.
                </p>
                {operations.map((operation) => (
                  <EndpointRow key={`${operation.method}:${operation.path}`} operation={operation} />
                ))}
              </div>
            )}
          </Card>

          <Card variant="glass" padding="lg">
            <SectionTitle icon={<Server size={18} />} title="MCP tools" />
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <ToolRow name="list_data_tables" description="Lista tablas y columnas disponibles de la base de datos, bloqueando tablas sensibles." />
              <ToolRow name="query_data_table" description="Consulta filas individuales de cualquier tabla expuesta con filtros, búsqueda, orden y paginación." />
              <ToolRow name="ghl_mcp__*" description="Herramientas del MCP oficial de GoHighLevel proxificadas por Ristak cuando HighLevel está configurado." />
              <ToolRow name="ghl_mcp_call_tool" description="Fallback para ejecutar una herramienta original del MCP de GoHighLevel por nombre." />
              <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: '0.875rem', lineHeight: 1.55 }}>
                La lista exacta de tools MCP se obtiene con `tools/list`, porque GoHighLevel puede cambiar lo disponible del lado upstream.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
    <span style={{ color: 'var(--color-primary)', lineHeight: 0 }}>{icon}</span>
    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
      {title}
    </h3>
  </div>
)

const ReadonlyField: React.FC<{
  label: string
  value: string
  onCopy: () => void
  external?: boolean
}> = ({ label, value, onCopy, external = false }) => (
  <div>
    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '0.375rem' }}>
      {label}
    </label>
    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
      <input
        type="text"
        value={value}
        readOnly
        style={{
          width: '100%',
          minWidth: 0,
          height: '2.5rem',
          padding: '0 0.875rem',
          background: 'rgba(148, 163, 184, 0.06)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '0.625rem',
          color: 'var(--color-text-primary)',
          fontSize: '0.8125rem'
        }}
      />
      {external && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir ${label}`}
          style={{ color: 'var(--color-text-secondary)', lineHeight: 0, padding: '0.5rem' }}
        >
          <ExternalLink size={17} />
        </a>
      )}
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copiar ${label}`}
        style={{
          border: '1px solid rgba(148, 163, 184, 0.18)',
          background: 'rgba(148, 163, 184, 0.08)',
          color: 'var(--color-text-secondary)',
          borderRadius: '0.625rem',
          cursor: 'pointer',
          padding: '0.625rem',
          lineHeight: 0
        }}
      >
        <Copy size={17} />
      </button>
    </div>
  </div>
)

const CodeBlock: React.FC<{ label: string; value: string; onCopy: () => void }> = ({ label, value, onCopy }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.375rem' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{label}</span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copiar ${label}`}
        style={{
          border: 0,
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          lineHeight: 0,
          padding: '0.25rem'
        }}
      >
        <Copy size={16} />
      </button>
    </div>
    <pre style={{
      margin: 0,
      padding: '0.875rem',
      overflowX: 'auto',
      background: 'rgba(15, 23, 42, 0.92)',
      color: '#e5e7eb',
      borderRadius: '0.625rem',
      fontSize: '0.8125rem',
      lineHeight: 1.55
    }}>
      <code>{value}</code>
    </pre>
  </div>
)

const EndpointRow: React.FC<{ operation: ApiOperation }> = ({ operation }) => (
  <div style={{
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1rem',
    background: 'rgba(148, 163, 184, 0.05)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <MethodBadge method={operation.method} />
      <code style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', wordBreak: 'break-all' }}>
        {operation.path}
      </code>
    </div>
    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
      {operation.summary || operation.operationId || 'Endpoint REST'}
    </p>
    {!!operation.parameters?.length && (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.625rem' }}>
        {operation.parameters.map((parameter) => (
          <span
            key={`${operation.method}:${operation.path}:${parameter.in}:${parameter.name}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '999px',
              background: 'rgba(148, 163, 184, 0.1)',
              color: 'var(--color-text-tertiary)',
              fontSize: '0.75rem'
            }}
          >
            {parameter.name}
            <span style={{ opacity: 0.75 }}>({parameter.in}{parameter.required ? ', req' : ''})</span>
          </span>
        ))}
      </div>
    )}
  </div>
)

const MethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const colors: Record<string, string> = {
    GET: '#22c55e',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    PATCH: '#a855f7',
    DELETE: '#ef4444'
  }

  return (
    <span style={{
      minWidth: '4.25rem',
      textAlign: 'center',
      padding: '0.25rem 0.5rem',
      borderRadius: '0.5rem',
      color: colors[method] || 'var(--color-text-primary)',
      background: `${colors[method] || '#94a3b8'}18`,
      fontSize: '0.75rem',
      fontWeight: 700
    }}>
      {method}
    </span>
  )
}

const ToolRow: React.FC<{ name: string; description: string }> = ({ name, description }) => (
  <div style={{
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1rem',
    background: 'rgba(148, 163, 184, 0.05)'
  }}>
    <code style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{name}</code>
    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
      {description}
    </p>
  </div>
)

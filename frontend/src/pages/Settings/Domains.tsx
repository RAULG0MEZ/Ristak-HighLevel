import React, { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Globe2, RefreshCw, Save } from 'lucide-react'
import { Button, Loading } from '@/components/common'
import { useNotification } from '@/contexts/NotificationContext'
import { sitesService, type PublicSite } from '@/services/sitesService'
import styles from './Domains.module.css'

const getDomainStatus = (site: PublicSite) => {
  if (!site.domain) return { label: 'Sin dominio', className: styles.statusMuted }
  if (site.renderDomainVerified) return { label: 'Verificado', className: styles.statusSuccess }
  return { label: 'Pendiente Render', className: styles.statusWarning }
}

export const Domains: React.FC = () => {
  const { showToast } = useNotification()
  const [sites, setSites] = useState<PublicSite[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSiteId, setSavingSiteId] = useState<string | null>(null)
  const [verifyingSiteId, setVerifyingSiteId] = useState<string | null>(null)

  useEffect(() => {
    loadSites()
  }, [])

  const loadSites = async () => {
    setLoading(true)
    try {
      setSites(await sitesService.listSites())
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudieron cargar dominios')
    } finally {
      setLoading(false)
    }
  }

  const patchSite = (siteId: string, patch: Partial<PublicSite>) => {
    setSites(current => current.map(site => site.id === siteId ? { ...site, ...patch } : site))
  }

  const saveSiteDomain = async (site: PublicSite) => {
    setSavingSiteId(site.id)
    try {
      const updated = await sitesService.updateSite(site.id, {
        domain: site.domain,
        status: site.status
      })
      patchSite(site.id, updated)
      showToast('success', 'Dominio guardado', 'Ahora verifica Render antes de publicar')
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo guardar el dominio')
    } finally {
      setSavingSiteId(null)
    }
  }

  const verifyDomain = async (site: PublicSite) => {
    setVerifyingSiteId(site.id)
    try {
      const result = await sitesService.verifyDomain(site.id)
      patchSite(site.id, result.site)
      if (result.verification.verified) {
        showToast('success', 'Dominio verificado', 'Render confirma este dominio en el servicio')
      } else {
        showToast('warning', 'Dominio pendiente', result.verification.error || 'Render aun no verifica el dominio')
      }
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo verificar el dominio')
    } finally {
      setVerifyingSiteId(null)
    }
  }

  if (loading) {
    return <Loading page="settings" />
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Globe2 size={26} />
        </div>
        <div>
          <h2>Dominios</h2>
          <p>Asocia cada site publico a un dominio exacto y valida que exista como Custom Domain verificado en Render.</p>
        </div>
        <Button variant="secondary" onClick={loadSites}>
          <RefreshCw size={16} />
          Refrescar
        </Button>
      </div>

      <div className={styles.infoBox}>
        <strong>Regla de publicacion</strong>
        <span>El dashboard sigue viviendo en el dominio principal y en .onrender.com. Un site publico solo responde si el Host coincide con el dominio guardado aqui, el site esta publicado y Render lo reporta como Custom Domain verificado.</span>
      </div>

      <div className={styles.domainList}>
        {sites.length === 0 ? (
          <div className={styles.emptyState}>
            <Globe2 size={28} />
            <p>No hay sites para configurar dominios.</p>
          </div>
        ) : sites.map(site => {
          const status = getDomainStatus(site)
          const publicUrl = site.domain ? `https://${site.domain}` : ''

          return (
            <article key={site.id} className={styles.domainCard}>
              <div className={styles.domainMeta}>
                <div>
                  <h3>{site.name}</h3>
                  <p>{site.title || site.slug}</p>
                </div>
                <span className={`${styles.statusPill} ${status.className}`}>{status.label}</span>
              </div>

              <div className={styles.domainControls}>
                <label className={styles.field}>
                  <span>Dominio exacto</span>
                  <input
                    value={site.domain}
                    placeholder="www.doctorramirez.com"
                    onChange={(event) => patchSite(site.id, { domain: event.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span>Estado del site</span>
                  <select
                    value={site.status}
                    onChange={(event) => patchSite(site.id, { status: event.target.value as PublicSite['status'] })}
                  >
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                    <option value="archived">Archivado</option>
                  </select>
                </label>
              </div>

              {site.renderDomainError && (
                <p className={styles.errorText}>{site.renderDomainError}</p>
              )}

              <div className={styles.actions}>
                {publicUrl && (
                  <a href={publicUrl} target="_blank" rel="noreferrer" className={styles.linkButton}>
                    <ExternalLink size={16} />
                    Abrir
                  </a>
                )}
                <Button variant="secondary" onClick={() => saveSiteDomain(site)} loading={savingSiteId === site.id}>
                  <Save size={16} />
                  Guardar
                </Button>
                <Button onClick={() => verifyDomain(site)} loading={verifyingSiteId === site.id}>
                  <CheckCircle2 size={16} />
                  Verificar Render
                </Button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

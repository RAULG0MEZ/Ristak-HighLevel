import React, { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Globe2, RefreshCw } from 'lucide-react'
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

  const verifyDomain = async (site: PublicSite) => {
    setVerifyingSiteId(site.id)
    try {
      const result = await sitesService.verifyDomain(site.id, site.domain)
      patchSite(site.id, result.site)
      if (result.verification.verified) {
        showToast('success', 'Dominio verificado y guardado', 'Render confirma este dominio en el servicio')
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
          <p>Conecta cada site publico a un dominio exacto y valida que exista como Custom Domain verificado en Render.</p>
        </div>
        <Button variant="secondary" onClick={loadSites}>
          <RefreshCw size={16} />
          Refrescar
        </Button>
      </div>

      <div className={styles.infoBox}>
        <strong>Validacion Render</strong>
        <span>El dominio se guarda solo cuando Render confirma que existe como Custom Domain verificado para este servicio.</span>
      </div>

      <div className={styles.domainList}>
        {sites.length === 0 ? (
          <div className={styles.emptyState}>
            <Globe2 size={28} />
            <p>No hay sites para configurar dominios.</p>
          </div>
        ) : sites.map(site => {
          const status = getDomainStatus(site)
          const publicUrl = site.domain ? `https://${site.domain}/${site.slug}` : ''

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
                    onChange={(event) => patchSite(site.id, {
                      domain: event.target.value,
                      renderDomainVerified: false,
                      renderDomainError: null
                    })}
                  />
                </label>
                <Button onClick={() => verifyDomain(site)} loading={verifyingSiteId === site.id} disabled={!site.domain.trim()}>
                  <CheckCircle2 size={16} />
                  Verificar dominio
                </Button>
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
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  ExternalLink,
  FileText,
  FormInput,
  Globe2,
  GripVertical,
  Image,
  LayoutTemplate,
  ListChecks,
  Monitor,
  MousePointerClick,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Smartphone,
  Trash2,
  Type,
  Video
} from 'lucide-react'
import { Button, Loading } from '@/components/common'
import { useNotification } from '@/contexts/NotificationContext'
import {
  blockLabels,
  fieldBlockTypes,
  formBlockTypes,
  landingBlockTypes,
  sitesService,
  type PublicSite,
  type SiteBlock,
  type SiteBlockOption,
  type SiteBlockType,
  type SiteOptionAction,
  type SiteSubmission,
  type SiteType
} from '@/services/sitesService'
import styles from './Sites.module.css'

type SitesSection = 'landings' | 'forms' | 'leads' | 'domains'
type DeviceMode = 'desktop' | 'mobile'
type CreateFlow = 'closed' | 'landing-start' | 'form-kind'

interface LeadRow extends SiteSubmission {
  siteName: string
}

const sectionItems: Array<{ id: SitesSection; label: string; icon: React.ReactNode }> = [
  { id: 'landings', label: 'Landing pages ("sitio web")', icon: <LayoutTemplate size={17} /> },
  { id: 'forms', label: 'Formularios', icon: <FormInput size={17} /> },
  { id: 'leads', label: 'Respuestas / Leads', icon: <ListChecks size={17} /> },
  { id: 'domains', label: 'Dominios / Publicacion', icon: <Globe2 size={17} /> }
]

const ruleActions: Array<{ value: SiteOptionAction; label: string }> = [
  { value: 'continue', label: 'Continuar normalmente' },
  { value: 'disqualify', label: 'Descalificar contacto' },
  { value: 'show_message', label: 'Mostrar mensaje de no calificado' },
  { value: 'jump', label: 'Saltar a otra pregunta' },
  { value: 'tag', label: 'Asignar etiqueta interna' },
  { value: 'category', label: 'Marcar lead con categoria' }
]

const blockIcons: Partial<Record<SiteBlockType, React.ReactNode>> = {
  headline: <Type size={15} />,
  subheading: <Type size={15} />,
  title: <Type size={15} />,
  subtitle: <Type size={15} />,
  description: <FileText size={15} />,
  text: <FileText size={15} />,
  embed: <Globe2 size={15} />,
  hero: <LayoutTemplate size={15} />,
  image: <Image size={15} />,
  video: <Video size={15} />,
  button: <MousePointerClick size={15} />,
  benefits: <ListChecks size={15} />,
  testimonials: <FileText size={15} />,
  services: <LayoutTemplate size={15} />,
  form_embed: <FormInput size={15} />,
  faq: <ListChecks size={15} />,
  cta: <Send size={15} />,
  short_text: <FormInput size={15} />,
  paragraph: <FileText size={15} />,
  currency: <DollarSign size={15} />,
  number: <FormInput size={15} />,
  dropdown: <ListChecks size={15} />,
  radio: <ListChecks size={15} />,
  checkboxes: <ListChecks size={15} />,
  phone: <FormInput size={15} />,
  email: <FormInput size={15} />,
  date: <FormInput size={15} />
}

const isChoiceBlock = (blockType: SiteBlockType) =>
  blockType === 'dropdown' || blockType === 'radio' || blockType === 'checkboxes'

const isLanding = (site?: PublicSite | null) => site?.siteType === 'landing_page'
const isFormSite = (site?: PublicSite | null) => site?.siteType === 'standard_form' || site?.siteType === 'interactive_form'

const formatDate = (value?: string | null) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const slugifyName = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'field'

const getStatusLabel = (site: PublicSite) => {
  if (site.status !== 'published') return site.status === 'draft' ? 'Borrador' : 'Archivado'
  if (!site.domain) return 'Sin dominio'
  return site.renderDomainVerified ? 'Publicado' : 'Dominio pendiente'
}

const getStatusClass = (site: PublicSite) => {
  if (site.status !== 'published') return styles.statusMuted
  if (!site.domain || !site.renderDomainVerified) return styles.statusWarning
  return styles.statusSuccess
}

const buildPublicUrl = (site: PublicSite) => site.domain ? `https://${site.domain}` : ''

const getCreateButtonLabel = (section: SitesSection) => {
  if (section === 'landings') return 'Crear landing page ("sitio web")'
  if (section === 'forms') return 'Crear formulario'
  return 'Nuevo sitio'
}

const getCreateFlowForSection = (section: SitesSection): CreateFlow => {
  if (section === 'forms') return 'form-kind'
  return 'landing-start'
}

const getEmptyEditorMessage = (section: SitesSection) => {
  if (section === 'landings') return 'Crea una landing page para entrar al editor visual.'
  if (section === 'forms') return 'Crea un formulario para entrar al editor visual.'
  return 'Crea una landing o formulario para entrar al editor visual.'
}

const getSettingString = (settings: Record<string, unknown>, key: string) => {
  const value = settings?.[key]
  return typeof value === 'string' ? value : ''
}

const normalizeOption = (option: string | SiteBlockOption, index: number): SiteBlockOption => {
  if (typeof option === 'string') {
    return {
      id: `option-${index}`,
      label: option,
      value: option,
      action: 'continue'
    }
  }

  const label = option.label || option.value || `Opcion ${index + 1}`
  return {
    id: option.id || `option-${index}`,
    label,
    value: option.value || label,
    action: option.action || 'continue',
    targetBlockId: option.targetBlockId || '',
    message: option.message || '',
    tag: option.tag || '',
    category: option.category || ''
  }
}

const getOptions = (block: SiteBlock): SiteBlockOption[] =>
  (block.options || []).map(normalizeOption)

const stringifyItems = (settings: Record<string, unknown>) => {
  const items = Array.isArray(settings.items) ? settings.items : []
  return items.map(item => {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      return [record.title, record.text, record.author].filter(Boolean).join(' | ')
    }
    return String(item || '')
  }).join('\n')
}

const parseItems = (value: string) => value
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    const [title, text, author] = line.split('|').map(part => part.trim())
    return { title, text: text || '', author: author || '' }
  })

const createEmbeddedBlocks = (siteId: string): SiteBlock[] => [
  {
    id: `embedded_${crypto.randomUUID()}`,
    siteId,
    blockType: 'short_text',
    label: 'Nombre completo',
    content: '',
    placeholder: 'Tu nombre',
    required: true,
    options: [],
    settings: { internalName: 'full_name' },
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: `embedded_${crypto.randomUUID()}`,
    siteId,
    blockType: 'email',
    label: 'Correo electronico',
    content: '',
    placeholder: 'tu@email.com',
    required: true,
    options: [],
    settings: { internalName: 'email', validation: 'email' },
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

const defaultBlockPayload = (blockType: SiteBlockType, siteId: string) => {
  const isField = fieldBlockTypes.has(blockType)
  const label = blockLabels[blockType]
  const baseSettings: Record<string, unknown> = isField
    ? { internalName: slugifyName(label), validation: blockType === 'email' ? 'email' : blockType === 'phone' ? 'phone' : '' }
    : {}

  if (blockType === 'hero') {
    return {
      blockType,
      label,
      content: 'Titular principal',
      settings: { kicker: 'Nuevo', subtitle: 'Subtitulo de la landing', buttonText: 'Comenzar', buttonUrl: '#form' }
    }
  }

  if (blockType === 'cta') {
    return {
      blockType,
      label,
      content: 'Listo para empezar?',
      settings: { subtitle: 'Deja tus datos y te contactamos.', buttonText: 'Enviar solicitud', buttonUrl: '#form' }
    }
  }

  if (blockType === 'button') {
    return {
      blockType,
      label,
      content: 'Boton',
      settings: { buttonText: 'Continuar', buttonUrl: '#form' }
    }
  }

  if (['benefits', 'testimonials', 'services', 'faq'].includes(blockType)) {
    return {
      blockType,
      label,
      content: label,
      settings: { items: [{ title: 'Elemento 1', text: 'Descripcion breve.' }, { title: 'Elemento 2', text: 'Descripcion breve.' }] }
    }
  }

  if (blockType === 'form_embed') {
    return {
      blockType,
      label,
      content: 'Formulario',
      settings: { description: 'Completa tus datos.', embeddedBlocks: createEmbeddedBlocks(siteId) }
    }
  }

  return {
    blockType,
    label,
    content: isField ? '' : label,
    placeholder: isField ? 'Escribe aqui' : '',
    required: false,
    options: isChoiceBlock(blockType)
      ? [
          { label: 'Opcion 1', value: 'Opcion 1', action: 'continue' as SiteOptionAction },
          { label: 'Opcion 2', value: 'Opcion 2', action: 'continue' as SiteOptionAction }
        ]
      : [],
    settings: baseSettings
  }
}

export const Sites: React.FC = () => {
  const { showToast } = useNotification()
  const navigate = useNavigate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [section, setSection] = useState<SitesSection>('landings')
  const [sites, setSites] = useState<PublicSite[]>([])
  const [selectedSite, setSelectedSite] = useState<PublicSite | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [createFlow, setCreateFlow] = useState<CreateFlow>('closed')
  const [leadRows, setLeadRows] = useState<LeadRow[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null)
  const guardHistoryArmedRef = useRef(false)
  const allowNavigationRef = useRef(false)

  const landings = useMemo(
    () => sites.filter(site => site.siteType === 'landing_page'),
    [sites]
  )
  const forms = useMemo(
    () => sites.filter(site => site.siteType === 'standard_form' || site.siteType === 'interactive_form'),
    [sites]
  )
  const blocks = useMemo(
    () => [...(selectedSite?.blocks || [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedSite?.blocks]
  )
  const selectedBlock = blocks.find(block => block.id === selectedBlockId) || blocks[0] || null
  const editorSite = section === 'landings'
    ? (isLanding(selectedSite) ? selectedSite : null)
    : section === 'forms'
      ? (isFormSite(selectedSite) ? selectedSite : null)
      : null
  const publicUrl = editorSite ? buildPublicUrl(editorSite) : ''

  const performUrlNavigation = useCallback((href: string) => {
    const target = new URL(href, window.location.href)

    if (target.origin === window.location.origin) {
      navigate(`${target.pathname}${target.search}${target.hash}`)
      return
    }

    window.location.href = target.href
  }, [navigate])

  const requestLeaveEditor = useCallback((action: () => void) => {
    if (!hasUnsavedChanges) {
      action()
      return
    }

    setPendingLeaveAction(() => action)
    setShowLeaveModal(true)
  }, [hasUnsavedChanges])

  const markEditorDirty = useCallback(() => {
    if (editorSite) {
      setHasUnsavedChanges(true)
    }
  }, [editorSite])

  const handleCancelLeaveEditor = useCallback(() => {
    setShowLeaveModal(false)
    setPendingLeaveAction(null)

    if (hasUnsavedChanges && !guardHistoryArmedRef.current) {
      window.history.pushState({ ristakSitesUnsavedGuard: true }, '', window.location.href)
      guardHistoryArmedRef.current = true
    }
  }, [hasUnsavedChanges])

  const handleConfirmLeaveEditor = useCallback(() => {
    const action = pendingLeaveAction

    allowNavigationRef.current = true
    guardHistoryArmedRef.current = false
    setHasUnsavedChanges(false)
    setShowLeaveModal(false)
    setPendingLeaveAction(null)

    action?.()

    window.setTimeout(() => {
      allowNavigationRef.current = false
    }, 500)
  }, [pendingLeaveAction])

  useEffect(() => {
    loadSites()
  }, [])

  useEffect(() => {
    if (selectedBlockId || !blocks[0]) return
    setSelectedBlockId(blocks[0].id)
  }, [blocks, selectedBlockId])

  useEffect(() => {
    if (section === 'leads') {
      loadLeads()
    }
  }, [section, sites.length])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      guardHistoryArmedRef.current = false
      return
    }

    if (!guardHistoryArmedRef.current) {
      window.history.pushState({ ristakSitesUnsavedGuard: true }, '', window.location.href)
      guardHistoryArmedRef.current = true
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return

      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        allowNavigationRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return
      }

      const target = event.target instanceof Element ? event.target : null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

      const targetUrl = new URL(anchor.href, window.location.href)
      if (targetUrl.href === window.location.href) return

      event.preventDefault()
      event.stopPropagation()
      setPendingLeaveAction(() => () => performUrlNavigation(targetUrl.href))
      setShowLeaveModal(true)
    }

    const handlePopState = () => {
      if (allowNavigationRef.current) return

      guardHistoryArmedRef.current = false
      setPendingLeaveAction(() => () => window.history.back())
      setShowLeaveModal(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [hasUnsavedChanges, performUrlNavigation])

  const loadSites = async (selectId?: string) => {
    setLoading(true)
    try {
      const list = await sitesService.listSites()
      setSites(list)
      const nextId = selectId || selectedSite?.id || list.find(site => site.siteType === 'landing_page')?.id || list[0]?.id
      if (nextId) {
        const site = await sitesService.getSite(nextId)
        setSelectedSite(site)
        setSelectedBlockId(site.blocks?.[0]?.id || '')
      } else {
        setSelectedSite(null)
        setSelectedBlockId('')
      }
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudieron cargar los sites')
    } finally {
      setLoading(false)
    }
  }

  const loadLeads = async () => {
    if (!sites.length) {
      setLeadRows([])
      return
    }

    setLoadingLeads(true)
    try {
      const details = await Promise.all(sites.map(site => sitesService.getSite(site.id)))
      const rows = details.flatMap(site =>
        (site.submissions || []).map(submission => ({
          ...submission,
          siteName: site.name
        }))
      )
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setLeadRows(rows)
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudieron cargar los leads')
    } finally {
      setLoadingLeads(false)
    }
  }

  const openSite = async (siteId: string) => {
    try {
      const site = await sitesService.getSite(siteId)
      setSelectedSite(site)
      setSelectedBlockId(site.blocks?.[0]?.id || '')
      setCreateFlow('closed')
      setHasUnsavedChanges(false)
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo abrir el site')
    }
  }

  const selectSite = (siteId: string) => {
    requestLeaveEditor(() => {
      void openSite(siteId)
    })
  }

  const changeSection = async (nextSection: SitesSection) => {
    setSection(nextSection)
    setCreateFlow('closed')
    setHasUnsavedChanges(false)

    if (nextSection === 'landings') {
      const first = selectedSite && isLanding(selectedSite) ? selectedSite : landings[0]
      if (first) {
        await openSite(first.id)
      } else {
        setSelectedSite(null)
        setSelectedBlockId('')
      }
    }

    if (nextSection === 'forms') {
      const first = selectedSite && isFormSite(selectedSite) ? selectedSite : forms[0]
      if (first) {
        await openSite(first.id)
      } else {
        setSelectedSite(null)
        setSelectedBlockId('')
      }
    }
  }

  const handleSectionChange = (nextSection: SitesSection) => {
    if (nextSection === section) return

    requestLeaveEditor(() => {
      void changeSection(nextSection)
    })
  }

  const handleStartCreateFlow = () => {
    requestLeaveEditor(() => {
      setCreateFlow(getCreateFlowForSection(section))
      setHasUnsavedChanges(false)
    })
  }

  const syncSelectedSite = (site: PublicSite) => {
    setSelectedSite(site)
    setSelectedBlockId(current => site.blocks?.some(block => block.id === current) ? current : site.blocks?.[0]?.id || '')
    setSites(current => current.map(item => item.id === site.id ? { ...item, ...site } : item))
  }

  const updateSelectedSite = (patch: Partial<PublicSite>) => {
    markEditorDirty()
    setSelectedSite(current => current ? { ...current, ...patch } : current)
  }

  const handleCreateSite = async (siteType: SiteType, mode: 'blank' | 'template' = 'template') => {
    setCreating(true)
    try {
      let site = await sitesService.createSite({
        name: siteType === 'landing_page' ? 'Nueva landing' : siteType === 'interactive_form' ? 'Nuevo formulario interactivo' : 'Nuevo formulario',
        siteType,
        title: siteType === 'landing_page' ? 'Nueva landing' : 'Nuevo formulario'
      })

      if (siteType === 'landing_page' && mode === 'blank') {
        for (const block of site.blocks || []) {
          site = await sitesService.deleteBlock(site.id, block.id)
        }
      }

      setSites(current => [site, ...current])
      setSelectedSite(site)
      setSelectedBlockId(site.blocks?.[0]?.id || '')
      setSection(siteType === 'landing_page' ? 'landings' : 'forms')
      setCreateFlow('closed')
      setHasUnsavedChanges(false)
      showToast('success', 'Sitio creado', 'Ya estas en el editor visual')
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo crear el sitio')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveSite = async (statusOverride?: PublicSite['status']) => {
    if (!selectedSite) return
    setSaving(true)
    try {
      const site = await sitesService.updateSite(selectedSite.id, {
        name: selectedSite.name,
        slug: selectedSite.slug,
        siteType: selectedSite.siteType,
        status: statusOverride || selectedSite.status,
        domain: selectedSite.domain,
        title: selectedSite.title,
        description: selectedSite.description,
        theme: selectedSite.theme,
        metaCapiEnabled: selectedSite.metaCapiEnabled,
        metaEventName: selectedSite.metaEventName
      })
      syncSelectedSite(site)
      setHasUnsavedChanges(false)
      showToast('success', statusOverride === 'published' ? 'Publicado' : 'Guardado', 'Sitio actualizado')
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleVerifyDomain = async () => {
    if (!selectedSite) return
    setVerifying(true)
    try {
      const result = await sitesService.verifyDomain(selectedSite.id)
      syncSelectedSite(result.site)
      if (result.verification.verified) {
        showToast('success', 'Dominio verificado', 'Render ya reconoce este dominio para el servicio')
      } else {
        showToast('warning', 'Dominio pendiente', result.verification.error || 'Render aun no lo verifica')
      }
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo verificar el dominio')
    } finally {
      setVerifying(false)
    }
  }

  const handleDeleteSite = async () => {
    if (!selectedSite) return
    const confirmed = window.confirm(`Eliminar "${selectedSite.name}" y sus respuestas?`)
    if (!confirmed) return

    try {
      await sitesService.deleteSite(selectedSite.id)
      const nextSites = sites.filter(site => site.id !== selectedSite.id)
      setSites(nextSites)
      const pool = section === 'landings'
        ? nextSites.filter(site => site.siteType === 'landing_page')
        : nextSites.filter(site => site.siteType !== 'landing_page')
      const next = pool[0] || nextSites[0]
      setSelectedSite(next ? await sitesService.getSite(next.id) : null)
      setSelectedBlockId('')
      setHasUnsavedChanges(false)
      showToast('success', 'Eliminado', 'Sitio eliminado')
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo eliminar')
    }
  }

  const handleAddBlock = async (blockType: SiteBlockType) => {
    if (!selectedSite) return
    try {
      const site = await sitesService.createBlock(selectedSite.id, defaultBlockPayload(blockType, selectedSite.id))
      syncSelectedSite(site)
      const added = [...(site.blocks || [])].sort((a, b) => b.sortOrder - a.sortOrder)[0]
      if (added) setSelectedBlockId(added.id)
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo agregar el bloque')
    }
  }

  const patchBlockLocal = (blockId: string, patch: Partial<SiteBlock>) => {
    markEditorDirty()
    setSelectedSite(current => {
      if (!current?.blocks) return current
      return {
        ...current,
        blocks: current.blocks.map(block => block.id === blockId ? { ...block, ...patch } : block)
      }
    })
  }

  const patchSelectedBlock = (patch: Partial<SiteBlock>) => {
    if (!selectedBlock) return
    patchBlockLocal(selectedBlock.id, patch)
  }

  const patchSelectedBlockSettings = (patch: Record<string, unknown>) => {
    if (!selectedBlock) return
    patchSelectedBlock({
      settings: {
        ...(selectedBlock.settings || {}),
        ...patch
      }
    })
  }

  const handleSaveBlock = async (blockId = selectedBlock?.id) => {
    if (!selectedSite?.blocks || !blockId) return
    const block = selectedSite.blocks.find(item => item.id === blockId)
    if (!block) return

    try {
      const site = await sitesService.updateBlock(selectedSite.id, block.id, block)
      syncSelectedSite(site)
      setHasUnsavedChanges(false)
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo guardar el bloque')
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!selectedSite) return
    try {
      const site = await sitesService.deleteBlock(selectedSite.id, blockId)
      syncSelectedSite(site)
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo eliminar el bloque')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!selectedSite || !event.over || event.active.id === event.over.id) return

    const oldIndex = blocks.findIndex(block => block.id === event.active.id)
    const newIndex = blocks.findIndex(block => block.id === event.over?.id)
    if (oldIndex < 0 || newIndex < 0) return

    const wasAlreadyDirty = hasUnsavedChanges
    const nextBlocks = arrayMove(blocks, oldIndex, newIndex).map((block, index) => ({ ...block, sortOrder: index }))
    setHasUnsavedChanges(true)
    setSelectedSite(current => current ? { ...current, blocks: nextBlocks } : current)

    try {
      const site = await sitesService.reorderBlocks(selectedSite.id, nextBlocks.map(block => block.id))
      syncSelectedSite(site)
      if (!wasAlreadyDirty) {
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo reordenar')
    }
  }

  const handleCanvasDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const blockType = event.dataTransfer.getData('application/ristak-block') as SiteBlockType
    if (blockType) await handleAddBlock(blockType)
  }

  if (loading) {
    return <Loading page="dashboard" />
  }

  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Sitios</h1>
            <p className={styles.subtitle}>Constructor visual controlado para landings, formularios, leads y publicacion por dominio verificado.</p>
          </div>
        </header>

        <div className={styles.sitesShell}>
          <aside className={styles.internalSidebar}>
            <nav className={styles.sectionNav}>
              {sectionItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.sectionButton} ${section === item.id ? styles.sectionButtonActive : ''}`}
                  onClick={() => handleSectionChange(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {(section === 'landings' || section === 'forms') && (
              <div className={styles.siteList}>
                <div className={styles.panelHeader}>
                  <strong>{section === 'landings' ? 'Landing pages ("sitio web")' : 'Formularios'}</strong>
                  <span>{section === 'landings' ? landings.length : forms.length}</span>
                </div>
                <div className={styles.siteItems}>
                  {(section === 'landings' ? landings : forms).length === 0 ? (
                    <div className={styles.emptyState}>
                      <Globe2 size={22} />
                      <p>No hay nada creado todavia.</p>
                    </div>
                  ) : (section === 'landings' ? landings : forms).map(site => (
                    <button
                      key={site.id}
                      type="button"
                      className={`${styles.siteItem} ${selectedSite?.id === site.id ? styles.siteItemActive : ''}`}
                      onClick={() => selectSite(site.id)}
                    >
                      <span className={styles.siteName}>{site.name}</span>
                      <span className={styles.siteDomain}>{site.domain || 'Sin dominio'}</span>
                      <span className={`${styles.statusPill} ${getStatusClass(site)}`}>{getStatusLabel(site)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className={styles.mainSurface}>
            {createFlow !== 'closed' ? (
              <CreateFlowPanel
                step={createFlow}
                creating={creating}
                onCreate={handleCreateSite}
              />
            ) : section === 'leads' ? (
              <LeadsPanel rows={leadRows} loading={loadingLeads} onRefresh={loadLeads} />
            ) : section === 'domains' ? (
              <DomainsPanel
                sites={sites}
                selectedSite={selectedSite}
                verifying={verifying}
                saving={saving}
                onSelect={selectSite}
                onPatchSite={updateSelectedSite}
                onSaveSite={handleSaveSite}
                onVerifyDomain={handleVerifyDomain}
              />
            ) : editorSite ? (
              <section className={styles.builder}>
                <div className={styles.builderHeader}>
                  <div>
                    <span className={`${styles.statusPill} ${getStatusClass(editorSite)}`}>{getStatusLabel(editorSite)}</span>
                    <h2>{editorSite.name}</h2>
                    <p>{editorSite.siteType === 'landing_page' ? 'Editor visual de landing page' : editorSite.siteType === 'interactive_form' ? 'Formulario interactivo, una pregunta por pantalla' : 'Formulario de una sola pagina'}</p>
                  </div>
                  <div className={styles.editorActions}>
                    {publicUrl && (
                      <a className={styles.iconLink} href={publicUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} />
                        Abrir
                      </a>
                    )}
                    <Button variant="secondary" onClick={() => handleSaveSite()} loading={saving}>
                      <Save size={16} />
                      Guardar
                    </Button>
                    <Button onClick={() => handleSaveSite('published')} loading={saving}>
                      <Send size={16} />
                      Publicar
                    </Button>
                    <Button variant="danger" onClick={handleDeleteSite}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

              <div className={styles.siteSettingsBar}>
                <label className={styles.inlineField}>
                  <span>Nombre</span>
                  <input value={editorSite.name} onChange={(event) => updateSelectedSite({ name: event.target.value })} />
                </label>
                <label className={styles.inlineField}>
                  <span>Titulo publico</span>
                  <input value={editorSite.title} onChange={(event) => updateSelectedSite({ title: event.target.value })} />
                </label>
                <label className={styles.inlineField}>
                  <span>Estado</span>
                  <select value={editorSite.status} onChange={(event) => updateSelectedSite({ status: event.target.value as PublicSite['status'] })}>
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                    <option value="archived">Archivado</option>
                  </select>
                </label>
                <div className={styles.deviceToggle}>
                  <button type="button" className={device === 'desktop' ? styles.deviceActive : ''} onClick={() => setDevice('desktop')} title="Desktop">
                    <Monitor size={16} />
                  </button>
                  <button type="button" className={device === 'mobile' ? styles.deviceActive : ''} onClick={() => setDevice('mobile')} title="Movil">
                    <Smartphone size={16} />
                  </button>
                </div>
              </div>

              <div className={styles.builderGrid}>
                <Palette
                  blockTypes={isLanding(editorSite) ? landingBlockTypes : formBlockTypes}
                  onAdd={handleAddBlock}
                />

                <section className={styles.canvasColumn}>
                  <div className={styles.canvasToolbar}>
                    <strong>Canvas</strong>
                    <span>{blocks.length} bloques</span>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={blocks.map(block => block.id)} strategy={verticalListSortingStrategy}>
                      <div
                        className={`${styles.canvasWrap} ${device === 'mobile' ? styles.canvasWrapMobile : ''}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleCanvasDrop}
                      >
                        <div
                          className={`${styles.pageCanvas} ${editorSite.siteType === 'interactive_form' ? styles.interactiveCanvas : ''}`}
                          style={{
                            '--site-accent': editorSite.theme?.accentColor || '#111827',
                            '--site-background': editorSite.theme?.backgroundColor || '#ffffff',
                            '--site-text': editorSite.theme?.textColor || '#111827'
                          } as React.CSSProperties}
                        >
                          {blocks.length === 0 ? (
                            <div className={styles.dropEmpty}>
                              <Plus size={24} />
                              <p>Arrastra bloques desde la barra lateral o da click para agregarlos.</p>
                            </div>
                          ) : blocks.map((block, index) => (
                            <SortableCanvasBlock
                              key={block.id}
                              block={block}
                              index={index}
                              selected={selectedBlock?.id === block.id}
                              site={editorSite}
                              forms={forms}
                              onSelect={() => setSelectedBlockId(block.id)}
                              onDelete={() => handleDeleteBlock(block.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </SortableContext>
                  </DndContext>
                </section>

                <PropertiesPanel
                  site={editorSite}
                  block={selectedBlock}
                  blocks={blocks}
                  forms={forms}
                  onPatchBlock={patchSelectedBlock}
                  onPatchSettings={patchSelectedBlockSettings}
                  onSave={() => handleSaveBlock()}
                  onDelete={() => selectedBlock && handleDeleteBlock(selectedBlock.id)}
                />
              </div>
            </section>
          ) : (
            <div className={styles.emptyEditor}>
              <LayoutTemplate size={34} />
              <p>{getEmptyEditorMessage(section)}</p>
              <Button onClick={handleStartCreateFlow}>
                <Plus size={16} />
                {getCreateButtonLabel(section)}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
    {showLeaveModal && (
      <UnsavedChangesModal
        onStay={handleCancelLeaveEditor}
        onLeave={handleConfirmLeaveEditor}
      />
    )}
    </>
  )
}

interface UnsavedChangesModalProps {
  onStay: () => void
  onLeave: () => void
}

const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({ onStay, onLeave }) => (
  <div className={styles.unsavedModalBackdrop}>
    <section className={styles.unsavedModal} role="dialog" aria-modal="true" aria-labelledby="unsaved-sites-title">
      <div className={styles.unsavedModalIcon}>
        <AlertTriangle size={22} />
      </div>
      <h2 id="unsaved-sites-title">Cambios sin guardar</h2>
      <p>
        Hay cambios en el editor que todavia no se han guardado o publicado. Si sales ahora, esos ajustes se van a perder.
      </p>
      <div className={styles.unsavedModalActions}>
        <Button variant="secondary" onClick={onStay}>
          Seguir editando
        </Button>
        <Button variant="danger" onClick={onLeave}>
          Salir sin guardar
        </Button>
      </div>
    </section>
  </div>
)

interface CreateFlowPanelProps {
  step: CreateFlow
  creating: boolean
  onCreate: (siteType: SiteType, mode?: 'blank' | 'template') => void
}

const CreateFlowPanel: React.FC<CreateFlowPanelProps> = ({ step, creating, onCreate }) => {
  return (
    <section className={styles.createPanel}>
      <div className={styles.createHeader}>
        <span>{step === 'landing-start' ? 'Nueva landing ("sitio web")' : 'Nuevo formulario'}</span>
        <h2>{step === 'landing-start' ? 'Como quieres iniciar la landing?' : 'Que tipo de formulario quieres?'}</h2>
      </div>

      {step === 'landing-start' && (
        <div className={styles.choiceGrid}>
          <button type="button" disabled={creating} onClick={() => onCreate('landing_page', 'template')}>
            <LayoutTemplate size={22} />
            <strong>Usar plantilla</strong>
            <p>Arranca con Hero, beneficios y CTA final listos para editar.</p>
            <ChevronRight size={18} />
          </button>
          <button type="button" disabled={creating} onClick={() => onCreate('landing_page', 'blank')}>
            <FileText size={22} />
            <strong>Empezar en blanco</strong>
            <p>Canvas limpio para agregar solo los bloques que necesitas.</p>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {step === 'form-kind' && (
        <div className={styles.choiceGrid}>
          <button type="button" disabled={creating} onClick={() => onCreate('standard_form')}>
            <FormInput size={22} />
            <strong>Una sola pagina</strong>
            <p>Todos los campos visibles en una pagina estructurada.</p>
            <ChevronRight size={18} />
          </button>
          <button type="button" disabled={creating} onClick={() => onCreate('interactive_form')}>
            <MousePointerClick size={22} />
            <strong>Interactivo</strong>
            <p>Una pregunta por pantalla, con saltos y descalificacion.</p>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  )
}

const Palette: React.FC<{ blockTypes: SiteBlockType[]; onAdd: (blockType: SiteBlockType) => void }> = ({ blockTypes, onAdd }) => (
  <aside className={styles.palette}>
    <div className={styles.panelHeader}>
      <strong>Bloques</strong>
      <span>Arrastra o da click</span>
    </div>
    <div className={styles.paletteItems}>
      {blockTypes.map(blockType => (
        <button
          key={blockType}
          type="button"
          draggable
          onDragStart={(event) => event.dataTransfer.setData('application/ristak-block', blockType)}
          onClick={() => onAdd(blockType)}
        >
          {blockIcons[blockType]}
          <span>{blockLabels[blockType]}</span>
        </button>
      ))}
    </div>
  </aside>
)

interface SortableCanvasBlockProps {
  block: SiteBlock
  index: number
  selected: boolean
  site: PublicSite
  forms: PublicSite[]
  onSelect: () => void
  onDelete: () => void
}

const SortableCanvasBlock: React.FC<SortableCanvasBlockProps> = ({ block, index, selected, site, forms, onSelect, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.canvasBlock} ${selected ? styles.canvasBlockSelected : ''} ${isDragging ? styles.canvasBlockDragging : ''}`}
      onClick={onSelect}
    >
      <button type="button" className={styles.dragHandle} {...attributes} {...listeners} aria-label="Reordenar bloque">
        <GripVertical size={16} />
      </button>
      {site.siteType === 'interactive_form' && fieldBlockTypes.has(block.blockType) && (
        <span className={styles.stepBadge}>Pantalla {index + 1}</span>
      )}
      <button type="button" className={styles.blockDelete} onClick={(event) => { event.stopPropagation(); onDelete() }} aria-label="Eliminar bloque">
        <Trash2 size={15} />
      </button>
      <CanvasPreviewBlock block={block} forms={forms} />
    </article>
  )
}

const CanvasPreviewBlock: React.FC<{ block: SiteBlock; forms: PublicSite[] }> = ({ block, forms }) => {
  const settings = block.settings || {}

  if (block.blockType === 'hero') {
    return (
      <section className={styles.previewHero}>
        {getSettingString(settings, 'kicker') && <span>{getSettingString(settings, 'kicker')}</span>}
        <h1>{block.content || block.label}</h1>
        {getSettingString(settings, 'subtitle') && <p>{getSettingString(settings, 'subtitle')}</p>}
        {getSettingString(settings, 'buttonText') && <button type="button">{getSettingString(settings, 'buttonText')}</button>}
      </section>
    )
  }

  if (['headline', 'title'].includes(block.blockType)) {
    return <h1 className={styles.previewHeadline}>{block.content || block.label}</h1>
  }

  if (['subheading', 'subtitle', 'description'].includes(block.blockType)) {
    return <p className={styles.previewSubheading}>{block.content || block.label}</p>
  }

  if (block.blockType === 'text') {
    return <p className={styles.previewText}>{block.content || 'Texto de contenido'}</p>
  }

  if (block.blockType === 'image') {
    return <div className={styles.previewMedia}>{getSettingString(settings, 'mediaUrl') || block.content || 'Imagen'}</div>
  }

  if (block.blockType === 'video') {
    return <div className={styles.previewMedia}>{getSettingString(settings, 'mediaUrl') || block.content || 'Video'}</div>
  }

  if (block.blockType === 'button') {
    return <button type="button" className={styles.previewButton}>{getSettingString(settings, 'buttonText') || block.content || 'Boton'}</button>
  }

  if (['benefits', 'testimonials', 'services', 'faq'].includes(block.blockType)) {
    const items = Array.isArray(settings.items) ? settings.items : []
    return (
      <section className={styles.previewList}>
        <h2>{block.content || block.label}</h2>
        <div>
          {items.slice(0, 3).map((item, index) => {
            const record = item && typeof item === 'object' ? item as Record<string, unknown> : { title: item }
            return (
              <article key={index}>
                <strong>{String(record.title || `Elemento ${index + 1}`)}</strong>
                {record.text && <p>{String(record.text)}</p>}
              </article>
            )
          })}
        </div>
      </section>
    )
  }

  if (block.blockType === 'form_embed') {
    const formSiteId = getSettingString(settings, 'formSiteId')
    const form = forms.find(item => item.id === formSiteId)
    const embeddedBlocks = Array.isArray(settings.embeddedBlocks) ? settings.embeddedBlocks as SiteBlock[] : []
    return (
      <section className={styles.previewEmbeddedForm}>
        <h2>{block.content || 'Formulario'}</h2>
        <p>{form ? `Usando: ${form.name}` : getSettingString(settings, 'description') || 'Formulario embebido'}</p>
        {(embeddedBlocks.length ? embeddedBlocks : [{ id: 'placeholder', blockType: 'short_text', label: 'Campo', required: true } as SiteBlock]).slice(0, 3).map(field => (
          <div key={field.id} className={styles.previewField}>
            <label>{field.label}{field.required ? ' *' : ''}</label>
            <input disabled placeholder={field.placeholder || 'Respuesta'} />
          </div>
        ))}
      </section>
    )
  }

  if (block.blockType === 'cta') {
    return (
      <section className={styles.previewCta}>
        <h2>{block.content || block.label}</h2>
        {getSettingString(settings, 'subtitle') && <p>{getSettingString(settings, 'subtitle')}</p>}
        {getSettingString(settings, 'buttonText') && <button type="button">{getSettingString(settings, 'buttonText')}</button>}
      </section>
    )
  }

  if (block.blockType === 'embed') {
    return <div className={styles.previewEmbed}>{block.content || 'Embed / contenido embebido'}</div>
  }

  return <FieldPreview block={block} />
}

const FieldPreview: React.FC<{ block: SiteBlock }> = ({ block }) => (
  <div className={styles.previewField}>
    <label>{block.label}{block.required ? ' *' : ''}</label>
    {block.content && <p>{block.content}</p>}
    {block.blockType === 'paragraph' ? (
      <textarea rows={3} placeholder={block.placeholder} disabled />
    ) : isChoiceBlock(block.blockType) ? (
      <div className={styles.previewOptions}>
        {getOptions(block).map(option => <span key={option.id || option.label}>{option.label}</span>)}
      </div>
    ) : (
      <input
        type={block.blockType === 'email' ? 'email' : block.blockType === 'phone' ? 'tel' : block.blockType === 'date' ? 'date' : 'text'}
        placeholder={block.placeholder}
        disabled
      />
    )}
  </div>
)

interface PropertiesPanelProps {
  site: PublicSite
  block: SiteBlock | null
  blocks: SiteBlock[]
  forms: PublicSite[]
  onPatchBlock: (patch: Partial<SiteBlock>) => void
  onPatchSettings: (patch: Record<string, unknown>) => void
  onSave: () => void
  onDelete: () => void
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  site,
  block,
  blocks,
  forms,
  onPatchBlock,
  onPatchSettings,
  onSave,
  onDelete
}) => {
  if (!block) {
    return (
      <aside className={styles.propertiesPanel}>
        <div className={styles.emptyState}>
          <Settings2 size={24} />
          <p>Selecciona un bloque para editar sus propiedades.</p>
        </div>
      </aside>
    )
  }

  const isField = fieldBlockTypes.has(block.blockType)
  const settings = block.settings || {}

  return (
    <aside className={styles.propertiesPanel}>
      <div className={styles.panelHeader}>
        <strong>Propiedades</strong>
        <span>{blockLabels[block.blockType]}</span>
      </div>

      <div className={styles.propertiesBody}>
        <label className={styles.field}>
          <span>{isField ? 'Label / pregunta' : 'Nombre del bloque'}</span>
          <input value={block.label} onChange={(event) => onPatchBlock({ label: event.target.value })} onBlur={onSave} />
        </label>

        <label className={styles.field}>
          <span>{isField ? 'Texto de ayuda' : block.blockType === 'embed' ? 'URL embebida' : 'Contenido'}</span>
          <textarea
            rows={isField ? 2 : 3}
            value={block.content}
            onChange={(event) => onPatchBlock({ content: event.target.value })}
            onBlur={onSave}
          />
        </label>

        {isField && (
          <>
            <div className={styles.twoColumn}>
              <label className={styles.field}>
                <span>Placeholder</span>
                <input value={block.placeholder} onChange={(event) => onPatchBlock({ placeholder: event.target.value })} onBlur={onSave} />
              </label>
              <label className={styles.field}>
                <span>Nombre interno</span>
                <input
                  value={getSettingString(settings, 'internalName')}
                  onChange={(event) => onPatchSettings({ internalName: event.target.value })}
                  onBlur={onSave}
                />
              </label>
            </div>

            <div className={styles.twoColumn}>
              <label className={styles.field}>
                <span>Validacion basica</span>
                <select
                  value={getSettingString(settings, 'validation')}
                  onChange={(event) => onPatchSettings({ validation: event.target.value })}
                  onBlur={onSave}
                >
                  <option value="">Ninguna</option>
                  <option value="email">Email</option>
                  <option value="phone">Telefono</option>
                  <option value="number">Numero</option>
                  <option value="currency">Moneda</option>
                  <option value="date">Fecha</option>
                </select>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={block.required}
                  onChange={(event) => {
                    onPatchBlock({ required: event.target.checked })
                    window.setTimeout(onSave, 0)
                  }}
                />
                <span>Campo requerido</span>
              </label>
            </div>
          </>
        )}

        {isChoiceBlock(block.blockType) && (
          <OptionsRulesEditor block={block} blocks={blocks} onPatchBlock={onPatchBlock} onSave={onSave} />
        )}

        {!isField && (
          <LandingBlockSettings
            site={site}
            block={block}
            forms={forms}
            onPatchSettings={onPatchSettings}
            onSave={onSave}
          />
        )}

        <div className={styles.propertiesActions}>
          <Button variant="secondary" onClick={onSave}>
            <Save size={16} />
            Guardar bloque
          </Button>
          <Button variant="danger" onClick={onDelete}>
            <Trash2 size={16} />
            Eliminar
          </Button>
        </div>
      </div>
    </aside>
  )
}

interface OptionsRulesEditorProps {
  block: SiteBlock
  blocks: SiteBlock[]
  onPatchBlock: (patch: Partial<SiteBlock>) => void
  onSave: () => void
}

const OptionsRulesEditor: React.FC<OptionsRulesEditorProps> = ({ block, blocks, onPatchBlock, onSave }) => {
  const options = getOptions(block)
  const fieldTargets = blocks.filter(item => fieldBlockTypes.has(item.blockType) && item.id !== block.id)

  const patchOption = (index: number, patch: Partial<SiteBlockOption>) => {
    const next = options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option)
    onPatchBlock({ options: next })
  }

  const addOption = () => {
    onPatchBlock({
      options: [
        ...options,
        {
          id: `option-${Date.now()}`,
          label: `Opcion ${options.length + 1}`,
          value: `Opcion ${options.length + 1}`,
          action: 'continue'
        }
      ]
    })
  }

  const removeOption = (index: number) => {
    onPatchBlock({ options: options.filter((_, optionIndex) => optionIndex !== index) })
  }

  return (
    <div className={styles.optionRules}>
      <div className={styles.optionRulesHeader}>
        <strong>Opciones y reglas</strong>
        <button type="button" onClick={addOption}>
          <Plus size={14} />
          Agregar
        </button>
      </div>
      {options.map((option, index) => (
        <div key={option.id || index} className={styles.optionRuleCard}>
          <div className={styles.twoColumn}>
            <label className={styles.field}>
              <span>Opcion</span>
              <input
                value={option.label}
                onChange={(event) => patchOption(index, { label: event.target.value, value: event.target.value })}
                onBlur={onSave}
              />
            </label>
            <label className={styles.field}>
              <span>Regla</span>
              <select
                value={option.action || 'continue'}
                onChange={(event) => patchOption(index, { action: event.target.value as SiteOptionAction })}
                onBlur={onSave}
              >
                {ruleActions.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
              </select>
            </label>
          </div>

          {option.action === 'jump' && (
            <label className={styles.field}>
              <span>Saltar a pregunta</span>
              <select value={option.targetBlockId || ''} onChange={(event) => patchOption(index, { targetBlockId: event.target.value })} onBlur={onSave}>
                <option value="">Selecciona una pregunta</option>
                {fieldTargets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}
              </select>
            </label>
          )}

          {(option.action === 'disqualify' || option.action === 'show_message') && (
            <label className={styles.field}>
              <span>Mensaje de no calificado</span>
              <textarea rows={2} value={option.message || ''} onChange={(event) => patchOption(index, { message: event.target.value })} onBlur={onSave} />
            </label>
          )}

          {(option.action === 'tag' || option.tag) && (
            <label className={styles.field}>
              <span>Etiqueta interna</span>
              <input value={option.tag || ''} onChange={(event) => patchOption(index, { tag: event.target.value })} onBlur={onSave} />
            </label>
          )}

          {(option.action === 'category' || option.category) && (
            <label className={styles.field}>
              <span>Categoria del lead</span>
              <input value={option.category || ''} onChange={(event) => patchOption(index, { category: event.target.value })} onBlur={onSave} />
            </label>
          )}

          <button type="button" className={styles.removeOption} onClick={() => removeOption(index)}>
            <Trash2 size={14} />
            Quitar opcion
          </button>
        </div>
      ))}
    </div>
  )
}

interface LandingBlockSettingsProps {
  site: PublicSite
  block: SiteBlock
  forms: PublicSite[]
  onPatchSettings: (patch: Record<string, unknown>) => void
  onSave: () => void
}

const LandingBlockSettings: React.FC<LandingBlockSettingsProps> = ({ site, block, forms, onPatchSettings, onSave }) => {
  const settings = block.settings || {}

  if (['hero', 'cta'].includes(block.blockType)) {
    return (
      <div className={styles.settingsGroup}>
        {block.blockType === 'hero' && (
          <label className={styles.field}>
            <span>Kicker</span>
            <input value={getSettingString(settings, 'kicker')} onChange={(event) => onPatchSettings({ kicker: event.target.value })} onBlur={onSave} />
          </label>
        )}
        <label className={styles.field}>
          <span>Subtitulo</span>
          <textarea rows={2} value={getSettingString(settings, 'subtitle')} onChange={(event) => onPatchSettings({ subtitle: event.target.value })} onBlur={onSave} />
        </label>
        <div className={styles.twoColumn}>
          <label className={styles.field}>
            <span>Texto del boton</span>
            <input value={getSettingString(settings, 'buttonText')} onChange={(event) => onPatchSettings({ buttonText: event.target.value })} onBlur={onSave} />
          </label>
          <label className={styles.field}>
            <span>URL del boton</span>
            <input value={getSettingString(settings, 'buttonUrl')} onChange={(event) => onPatchSettings({ buttonUrl: event.target.value })} onBlur={onSave} />
          </label>
        </div>
      </div>
    )
  }

  if (block.blockType === 'button') {
    return (
      <div className={styles.twoColumn}>
        <label className={styles.field}>
          <span>Texto del boton</span>
          <input value={getSettingString(settings, 'buttonText')} onChange={(event) => onPatchSettings({ buttonText: event.target.value })} onBlur={onSave} />
        </label>
        <label className={styles.field}>
          <span>URL</span>
          <input value={getSettingString(settings, 'buttonUrl')} onChange={(event) => onPatchSettings({ buttonUrl: event.target.value })} onBlur={onSave} />
        </label>
      </div>
    )
  }

  if (block.blockType === 'image' || block.blockType === 'video') {
    return (
      <label className={styles.field}>
        <span>{block.blockType === 'image' ? 'URL de imagen' : 'URL de video'}</span>
        <input value={getSettingString(settings, 'mediaUrl')} onChange={(event) => onPatchSettings({ mediaUrl: event.target.value })} onBlur={onSave} />
      </label>
    )
  }

  if (['benefits', 'testimonials', 'services', 'faq'].includes(block.blockType)) {
    return (
      <label className={styles.field}>
        <span>Items (uno por linea: titulo | texto | autor)</span>
        <textarea
          rows={5}
          value={stringifyItems(settings)}
          onChange={(event) => onPatchSettings({ items: parseItems(event.target.value) })}
          onBlur={onSave}
        />
      </label>
    )
  }

  if (block.blockType === 'form_embed') {
    const embeddedBlocks = Array.isArray(settings.embeddedBlocks) ? settings.embeddedBlocks as SiteBlock[] : []

    return (
      <div className={styles.settingsGroup}>
        <label className={styles.field}>
          <span>Formulario existente</span>
          <select value={getSettingString(settings, 'formSiteId')} onChange={(event) => onPatchSettings({ formSiteId: event.target.value, embeddedBlocks: undefined })} onBlur={onSave}>
            <option value="">Formulario inline dentro de esta landing</option>
            {forms.filter(form => form.id !== site.id).map(form => (
              <option key={form.id} value={form.id}>{form.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Descripcion del form</span>
          <textarea rows={2} value={getSettingString(settings, 'description')} onChange={(event) => onPatchSettings({ description: event.target.value })} onBlur={onSave} />
        </label>
        <button
          type="button"
          className={styles.inlineCreateButton}
          onClick={() => {
            onPatchSettings({ formSiteId: '', embeddedBlocks: createEmbeddedBlocks(site.id) })
            window.setTimeout(onSave, 0)
          }}
        >
          <Plus size={15} />
          Crear formulario inline basico
        </button>
        {embeddedBlocks.length > 0 && (
          <p className={styles.muted}>{embeddedBlocks.length} campos inline guardados en este bloque.</p>
        )}
      </div>
    )
  }

  return null
}

const LeadsPanel: React.FC<{ rows: LeadRow[]; loading: boolean; onRefresh: () => void }> = ({ rows, loading, onRefresh }) => (
  <section className={styles.dataPanel}>
    <div className={styles.builderHeader}>
      <div>
        <h2>Respuestas / Leads</h2>
        <p>Submissions recibidos desde landings y formularios publicos.</p>
      </div>
      <Button variant="secondary" onClick={onRefresh} loading={loading}>
        <RefreshCw size={16} />
        Refrescar
      </Button>
    </div>

    <div className={styles.leadsTable}>
      <div className={styles.leadsHeader}>
        <span>Lead</span>
        <span>Sitio</span>
        <span>Estado</span>
        <span>Reglas</span>
        <span>Fecha</span>
      </div>
      {rows.length === 0 ? (
        <div className={styles.emptyState}>
          <ListChecks size={24} />
          <p>No hay respuestas todavia.</p>
        </div>
      ) : rows.map(row => {
        const rules = row.meta?.rules && typeof row.meta.rules === 'object' ? row.meta.rules as Record<string, unknown> : {}
        const tags = Array.isArray(rules.tags) ? rules.tags.join(', ') : ''
        const categories = Array.isArray(rules.categories) ? rules.categories.join(', ') : ''
        return (
          <article key={row.id} className={styles.leadRow}>
            <span>{row.contactName || row.contactEmail || row.contactPhone || 'Lead sin nombre'}</span>
            <span>{row.siteName}</span>
            <span className={`${styles.statusPill} ${row.status === 'disqualified' ? styles.statusWarning : styles.statusSuccess}`}>
              {row.status === 'disqualified' ? 'Descalificado' : 'Recibido'}
            </span>
            <span>{[tags, categories].filter(Boolean).join(' / ') || 'Sin reglas'}</span>
            <span>{formatDate(row.createdAt)}</span>
          </article>
        )
      })}
    </div>
  </section>
)

interface DomainsPanelProps {
  sites: PublicSite[]
  selectedSite: PublicSite | null
  verifying: boolean
  saving: boolean
  onSelect: (siteId: string) => void
  onPatchSite: (patch: Partial<PublicSite>) => void
  onSaveSite: (statusOverride?: PublicSite['status']) => void
  onVerifyDomain: () => void
}

const DomainsPanel: React.FC<DomainsPanelProps> = ({
  sites,
  selectedSite,
  verifying,
  saving,
  onSelect,
  onPatchSite,
  onSaveSite,
  onVerifyDomain
}) => (
  <section className={styles.dataPanel}>
    <div className={styles.builderHeader}>
      <div>
        <h2>Dominios / Publicacion</h2>
        <p>El sitio publico solo se renderiza si el dominio coincide aqui y tambien existe como Custom Domain verificado en Render.</p>
      </div>
      {selectedSite && (
        <Button onClick={() => onSaveSite('published')} loading={saving}>
          <Send size={16} />
          Publicar seleccionado
        </Button>
      )}
    </div>

    <div className={styles.domainsGrid}>
      <aside className={styles.domainSiteList}>
        {sites.map(site => (
          <button
            key={site.id}
            type="button"
            className={`${styles.siteItem} ${selectedSite?.id === site.id ? styles.siteItemActive : ''}`}
            onClick={() => onSelect(site.id)}
          >
            <span className={styles.siteName}>{site.name}</span>
            <span className={styles.siteDomain}>{site.domain || 'Sin dominio'}</span>
            <span className={`${styles.statusPill} ${getStatusClass(site)}`}>{getStatusLabel(site)}</span>
          </button>
        ))}
      </aside>

      {selectedSite ? (
        <div className={styles.domainEditor}>
          <label className={styles.field}>
            <span>Dominio publico del site</span>
            <input
              value={selectedSite.domain}
              placeholder="www.doctorramirez.com"
              onChange={(event) => onPatchSite({ domain: event.target.value })}
            />
          </label>
          <div className={styles.twoColumn}>
            <label className={styles.field}>
              <span>Estado</span>
              <select value={selectedSite.status} onChange={(event) => onPatchSite({ status: event.target.value as PublicSite['status'] })}>
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Evento Meta CAPI</span>
              <input value={selectedSite.metaEventName} onChange={(event) => onPatchSite({ metaEventName: event.target.value })} />
            </label>
          </div>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={selectedSite.metaCapiEnabled}
              onChange={(event) => onPatchSite({ metaCapiEnabled: event.target.checked })}
            />
            <span>Enviar evento Meta CAPI desde servidor</span>
          </label>
          {selectedSite.renderDomainError && <p className={styles.domainError}>{selectedSite.renderDomainError}</p>}
          <div className={styles.editorActions}>
            <Button variant="secondary" onClick={() => onSaveSite()} loading={saving}>
              <Save size={16} />
              Guardar dominio
            </Button>
            <Button variant="secondary" onClick={onVerifyDomain} loading={verifying}>
              <CheckCircle2 size={16} />
              Verificar Render
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Globe2 size={24} />
          <p>Selecciona un sitio para configurar su dominio.</p>
        </div>
      )}
    </div>
  </section>
)

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard, Card, DateRangePicker, AreaChart, PageContainer, TrafficSourcesChart, ConversionFunnelChart, ViewSelector, Loading, ContactDetailsModal, VisitorDetailsModal, HelpTooltip } from '@/components/common'
import funnelStyles from '@/components/common/ConversionFunnelChart/ConversionFunnelChart.module.css'
import {
  DollarSign,
  Megaphone,
  TrendingUp,
  Target,
  Receipt,
  Wallet,
  RotateCcw,
  Users,
  Layers,
  MousePointerClick,
  CalendarClock,
  ArrowRight,
  UserPlus,
  Clock3,
  Banknote
} from 'lucide-react'
import { useDateRange } from '@/contexts/DateRangeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLabels } from '@/contexts/LabelsContext'
import { useTimezone } from '@/contexts/TimezoneContext'
import { useAppConfig, useIsRenderDomain, useMetaTimezone } from '@/hooks'
import { dashboardService, type DashboardMetrics, type ChartData, type DashboardVisitorDetail } from '@/services/dashboardService'
import { reportsService, type ContactListItem } from '@/services/reportsService'
import { transactionsService, type Transaction } from '@/services/transactionsService'
import { calendarsService, type CalendarEvent } from '@/services/calendarsService'
import { formatCurrency, formatRoas, formatChartDate, formatDateToISO, formatEndDateToISO, parseLocalDateString, formatChartCurrency, formatChartNumber, formatDate } from '@/utils/format'

const parseAnalyticsFlag = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  if (typeof value === 'number') {
    return value === 1
  }
  return Boolean(value)
}

type FunnelStageKind = 'visitors' | 'leads' | 'appointments' | 'attendances' | 'customers'
type ContactModalType = 'interesados' | 'sales' | 'appointments' | 'attendances'
type ChartView = 'revenue-spend' | 'visitors-leads' | 'leads-appointments' | 'appointments-attendances' | 'attendances-sales' | 'appointments-sales'

const TRANSACTION_STATUS_LABELS: Record<Transaction['status'], string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
  partial: 'Parcial',
  void: 'Anulado',
  refunded: 'Reembolsado',
  failed: 'Fallido',
  deleted: 'Eliminado'
}

const APPOINTMENT_STATUS_LABELS: Record<CalendarEvent['appointmentStatus'], string> = {
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  cancelled: 'Cancelada',
  showed: 'Asistió',
  noshow: 'No asistió',
  rescheduled: 'Reagendada'
}

const getTimeValue = (date?: string | null) => {
  if (!date) return 0
  const time = new Date(date).getTime()
  return Number.isNaN(time) ? 0 : time
}

const getTransactionDate = (transaction: Transaction) => (
  transaction.date || transaction.createdAt || transaction.sentAt || transaction.updatedAt || ''
)

const getContactCreatedAt = (contact: ContactListItem) => (
  contact.created_at || (contact as any).createdAt || ''
)

const getContactName = (contact: ContactListItem) => (
  contact.name || contact.email || contact.phone || 'Contacto sin nombre'
)

const getAppointmentTitle = (appointment: CalendarEvent) => (
  appointment.title || appointment.description || 'Cita sin título'
)

const isUpcomingAppointment = (appointment: CalendarEvent, now: number) => {
  const appointmentTime = getTimeValue(appointment.startTime)
  return appointmentTime >= now && appointment.appointmentStatus !== 'cancelled'
}

export const Dashboard: React.FC = () => {
  const { dateRange, setDateRange } = useDateRange()
  const { user, locationId, accessToken } = useAuth()
  const { labels } = useLabels()
  const { formatLocalDateTime } = useTimezone()

  // Detectar discrepancia de timezone con Meta
  const timezoneInfo = useMetaTimezone()

  // Detectar si estamos en dominio .onrender.com
  const isRenderDomain = useIsRenderDomain()

  // Sistema híbrido de configuración
  const [showAnalyticsConfig] = useAppConfig<string | number | boolean>('show_analytics', '1')

  // FORZAR analyticsEnabled a false si estamos en dominio .onrender.com
  const analyticsEnabled = isRenderDomain ? false : parseAnalyticsFlag(showAnalyticsConfig)

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [visitorsLeadsData, setVisitorsLeadsData] = useState<{ label: string; value: number; value2: number }[]>([])
  const [leadsAppointmentsData, setLeadsAppointmentsData] = useState<{ label: string; value: number; value2: number }[]>([])
  const [appointmentsAttendancesData, setAppointmentsAttendancesData] = useState<{ label: string; value: number; value2: number }[]>([])
  const [attendancesSalesData, setAttendancesSalesData] = useState<{ label: string; value: number; value2: number }[]>([])
  const [appointmentsSalesData, setAppointmentsSalesData] = useState<{ label: string; value: number; value2: number }[]>([])
  const [trafficSources, setTrafficSources] = useState<{ name: string; value: number; color: string }[]>([])
  const [funnelData, setFunnelData] = useState<{ stage: string; value: number }[]>([])
  const [funnelScope, setFunnelScope] = useState<'all' | 'attribution' | 'campaigns'>('all')
  const [financialScope, setFinancialScope] = useState<'all' | 'attribution' | 'campaigns'>('all')
  const [funnelLoading, setFunnelLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedChartView, setSelectedChartView] = useState<ChartView>('revenue-spend')
  const [extendedChartDataLoaded, setExtendedChartDataLoaded] = useState(false)
  const [extendedChartDataLoading, setExtendedChartDataLoading] = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactModalTitle, setContactModalTitle] = useState('')
  const [contactModalSubtitle, setContactModalSubtitle] = useState('')
  const [contactModalType, setContactModalType] = useState<ContactModalType>('interesados')
  const [contactModalLoading, setContactModalLoading] = useState(false)
  const [contactModalContacts, setContactModalContacts] = useState<ContactListItem[]>([])
  const [visitorsModalOpen, setVisitorsModalOpen] = useState(false)
  const [visitorsModalTitle, setVisitorsModalTitle] = useState('Visitantes')
  const [visitorsModalSubtitle, setVisitorsModalSubtitle] = useState('')
  const [visitorsModalLoading, setVisitorsModalLoading] = useState(false)
  const [visitorsModalData, setVisitorsModalData] = useState<DashboardVisitorDetail[]>([])
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [upcomingAppointments, setUpcomingAppointments] = useState<CalendarEvent[]>([])
  const [recentContacts, setRecentContacts] = useState<ContactListItem[]>([])

  const funnelChartData = React.useMemo(() => {
    if (analyticsEnabled) return funnelData
    return funnelData.filter((stage) => stage.stage?.trim().toLowerCase() !== 'visitantes')
  }, [analyticsEnabled, funnelData])

  const chartsGridClass = analyticsEnabled ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'

  // Agrupar datos financieros por mes para últimos 12 meses
  const formattedFinancialData = React.useMemo(() => {
    // Crear los últimos 12 meses
    const now = new Date()
    const last12Months: string[] = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      last12Months.push(monthKey)
    }

    // Agrupar datos por mes
    const monthlyData = chartData.reduce((acc, item) => {
      const date = new Date(item.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!acc[monthKey]) {
        acc[monthKey] = { ingresos: 0, gastado: 0 }
      }

      acc[monthKey].ingresos += item.ingresos
      acc[monthKey].gastado += item.gastado

      return acc
    }, {} as Record<string, { ingresos: number; gastado: number }>)

    // Crear array con todos los 12 meses (con o sin datos)
    return last12Months.map((monthKey, index) => ({
      label: formatChartDate(monthKey, 365, index > 0 ? last12Months[index - 1] : undefined),
      value: monthlyData[monthKey]?.ingresos || 0,
      value2: monthlyData[monthKey]?.gastado || 0
    }))
  }, [chartData])

  const currencyAxisFormatter = React.useCallback((value: number) => formatChartCurrency(value), [])

  // Configuración del gráfico según la vista seleccionada
  const chartConfig = React.useMemo(() => {
    const now = new Date()
    const last12Months: string[] = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      last12Months.push(monthKey)
    }

    const formatData = (rawData: { label: string; value: number; value2: number }[]) => {
      const dataMap = new Map(rawData.map(d => [d.label, d]))
      return last12Months.map((monthKey, index) => ({
        label: formatChartDate(monthKey, 365, index > 0 ? last12Months[index - 1] : undefined),
        value: dataMap.get(monthKey)?.value || 0,
        value2: dataMap.get(monthKey)?.value2 || 0
      }))
    }

    switch (selectedChartView) {
      case 'revenue-spend':
        return {
          data: formattedFinancialData,
          label1: 'Ingresos',
          label2: 'Gastos',
          color: 'var(--design-chart-primary, #10b981)',
          color2: 'var(--design-chart-secondary, #64748b)',
          formatValue: currencyAxisFormatter,
          formatTooltipValue: (value: number) => formatCurrency(value)
        }
      case 'visitors-leads':
        if (!analyticsEnabled) {
          return {
            data: formatData([]),
            label1: 'Ingresos',
            label2: 'Gastos',
            color: 'var(--design-chart-primary, #10b981)',
            color2: 'var(--design-chart-secondary, #64748b)',
            formatValue: currencyAxisFormatter,
            formatTooltipValue: (value: number) => formatCurrency(value)
          }
        }
        return {
          data: formatData(visitorsLeadsData),
          label1: 'Visitantes',
          label2: labels.leads,
          color: 'var(--design-chart-tertiary, #3b82f6)',
          color2: 'var(--design-chart-accent, #8b5cf6)',
          formatValue: formatChartNumber,
          formatTooltipValue: (value: number) => value.toLocaleString('es-MX')
        }
      case 'leads-appointments':
        return {
          data: formatData(leadsAppointmentsData),
          label1: labels.leads,
          label2: 'Citas',
          color: 'var(--design-chart-primary, #10b981)',
          color2: 'var(--design-chart-warning, #f59e0b)',
          formatValue: formatChartNumber,
          formatTooltipValue: (value: number) => value.toLocaleString('es-MX')
        }
      case 'appointments-attendances':
        return {
          data: formatData(appointmentsAttendancesData),
          label1: 'Citas',
          label2: 'Asistencias',
          color: 'var(--design-chart-warning, #f59e0b)',
          color2: 'var(--design-chart-tertiary, #3b82f6)',
          formatValue: formatChartNumber,
          formatTooltipValue: (value: number) => value.toLocaleString('es-MX')
        }
      case 'attendances-sales':
        return {
          data: formatData(attendancesSalesData),
          label1: 'Asistencias',
          label2: 'Ventas',
          color: 'var(--design-chart-tertiary, #3b82f6)',
          color2: 'var(--design-chart-primary, #10b981)',
          formatValue: formatChartNumber,
          formatTooltipValue: (value: number) => value.toLocaleString('es-MX')
        }
      case 'appointments-sales':
        return {
          data: formatData(appointmentsSalesData),
          label1: 'Citas',
          label2: 'Ventas',
          color: 'var(--design-chart-warning, #f59e0b)',
          color2: 'var(--design-chart-primary, #10b981)',
          formatValue: formatChartNumber,
          formatTooltipValue: (value: number) => value.toLocaleString('es-MX')
        }
      default:
        return {
          data: formattedFinancialData,
          label1: 'Ingresos',
          label2: 'Gastos',
          color: 'var(--design-chart-primary, #10b981)',
          color2: 'var(--design-chart-secondary, #64748b)',
          formatValue: currencyAxisFormatter,
          formatTooltipValue: (value: number) => formatCurrency(value)
        }
    }
  }, [analyticsEnabled, selectedChartView, formattedFinancialData, visitorsLeadsData, leadsAppointmentsData, appointmentsAttendancesData, attendancesSalesData, appointmentsSalesData, labels.leads, currencyAxisFormatter])

  const isExtendedChartView = selectedChartView !== 'revenue-spend'
  const isChartLoading = isExtendedChartView && extendedChartDataLoading

  const hasChartData = React.useMemo(
    () => chartConfig.data.some(item => (item.value ?? 0) !== 0 || (item.value2 ?? 0) !== 0),
    [chartConfig]
  )

  const chartHeight = 340

  const chartViewOptions = React.useMemo(() => {
    const options: Array<{ value: ChartView; label: string }> = [
      { value: 'revenue-spend', label: 'Ingresos vs Gastos' },
      { value: 'leads-appointments', label: `${labels.leads} vs Citas` },
      { value: 'appointments-attendances', label: 'Citas vs Asistencias' },
      { value: 'attendances-sales', label: 'Asistencias vs Ventas' },
      { value: 'appointments-sales', label: 'Citas vs Ventas' }
    ]

    if (analyticsEnabled) {
      options.splice(1, 0, { value: 'visitors-leads', label: `Visitantes vs ${labels.leads}` })
    }

    return options
  }, [analyticsEnabled, labels.leads])

  const activeChartLabel = React.useMemo(() => {
    const active = chartViewOptions.find(option => option.value === selectedChartView)
    return active?.label ?? 'Ingresos vs Gastos'
  }, [chartViewOptions, selectedChartView])

  const selectedRangeLabel = React.useMemo(() => {
    const from = formatDateToISO(dateRange.start)
    const to = formatDateToISO(dateRange.end)
    return from === to ? from : `${from} - ${to}`
  }, [dateRange.start, dateRange.end])

  const getFunnelStageKind = React.useCallback((stage: string): FunnelStageKind | null => {
    const normalized = stage.trim().toLowerCase()
    const leadsLabel = labels.leads.trim().toLowerCase()
    const customersLabel = labels.customers.trim().toLowerCase()

    if (normalized === 'visitantes') return 'visitors'
    if ([leadsLabel, 'leads', 'interesados', 'prospectos'].includes(normalized)) return 'leads'
    if (normalized === 'citas') return 'appointments'
    if (normalized === 'asistencias') return 'attendances'
    if ([customersLabel, 'clientes', 'customers'].includes(normalized)) return 'customers'
    return null
  }, [labels.customers, labels.leads])

  const handleFunnelStageClick = React.useCallback(async (stage: { stage: string; value: number }) => {
    const kind = getFunnelStageKind(stage.stage)
    if (!kind) return

    if (kind === 'visitors') {
      if (!analyticsEnabled) return

      setContactModalOpen(false)
      setVisitorsModalOpen(true)
      setVisitorsModalTitle('Visitantes')
      setVisitorsModalSubtitle(selectedRangeLabel)
      setVisitorsModalData([])
      setVisitorsModalLoading(true)

      try {
        const visitors = await dashboardService.getVisitorsList({
          start: dateRange.start,
          end: dateRange.end,
          scope: funnelScope
        })
        setVisitorsModalData(visitors)
      } catch {
        setVisitorsModalData([])
      } finally {
        setVisitorsModalLoading(false)
      }
      return
    }

    const contactConfig = {
      leads: { listType: 'interesados', modalType: 'interesados', title: labels.leads },
      appointments: { listType: 'appointments', modalType: 'appointments', title: 'Citas' },
      attendances: { listType: 'attendances', modalType: 'attendances', title: 'Asistencias' },
      customers: { listType: 'customers', modalType: 'sales', title: labels.customers }
    }[kind] as {
      listType: 'interesados' | 'customers' | 'appointments' | 'attendances'
      modalType: ContactModalType
      title: string
    }

    setVisitorsModalOpen(false)
    setContactModalOpen(true)
    setContactModalTitle(contactConfig.title)
    setContactModalSubtitle(selectedRangeLabel)
    setContactModalType(contactConfig.modalType)
    setContactModalContacts([])
    setContactModalLoading(true)

    try {
      const result = await reportsService.getContactsList({
        from: formatDateToISO(dateRange.start),
        to: formatEndDateToISO(dateRange.end),
        type: contactConfig.listType,
        scope: funnelScope
      })

      setContactModalContacts(result.contacts.map(contact => ({
        ...contact,
        created_at: contact.created_at || (contact as any).createdAt
      })))
    } catch {
      setContactModalContacts([])
    } finally {
      setContactModalLoading(false)
    }
  }, [analyticsEnabled, dateRange.end, dateRange.start, funnelScope, getFunnelStageKind, labels.customers, labels.leads, selectedRangeLabel])

  const financialScopeOptions = React.useMemo(
    () => [
      {
        value: 'all' as const,
        label: 'Todos',
        icon: Layers,
        description: 'Muestra ingresos y gasto por la fecha real en que ocurrió cada evento.'
      },
      {
        value: 'attribution' as const,
        label: 'Al registro',
        icon: Target,
        description: 'Agrupa los resultados en la fecha de creación del contacto para evaluar qué registros convirtieron.'
      },
      {
        value: 'campaigns' as const,
        label: 'Identificados de anuncios',
        icon: MousePointerClick,
        description: 'Filtra a contactos identificados desde anuncios y atribuye sus resultados al día de registro.'
      }
    ],
    []
  )

  useEffect(() => {
    if (!analyticsEnabled && selectedChartView === 'visitors-leads') {
      setSelectedChartView('revenue-spend')
    }
  }, [analyticsEnabled, selectedChartView])

  // Cargar datasets extendidos del gráfico solo cuando sean necesarios
  const loadExtendedChartData = React.useCallback(async () => {
    if (!user || extendedChartDataLoading || extendedChartDataLoaded) {
      return
    }

    setExtendedChartDataLoading(true)
    try {
      const now = new Date()
      const twelveMonthsAgo = new Date(now)
      twelveMonthsAgo.setMonth(now.getMonth() - 12)

      const visitorsPromise = analyticsEnabled
        ? dashboardService.getVisitorsData({ start: twelveMonthsAgo, end: now, groupBy: 'month' })
        : Promise.resolve<{ label: string; value: number }[]>([])

      const [visitorsData, leadsData, appointmentsData, attendancesData, salesData] = await Promise.all([
        visitorsPromise,
        dashboardService.getLeadsData({ start: twelveMonthsAgo, end: now, groupBy: 'month' }),
        dashboardService.getAppointmentsData({ start: twelveMonthsAgo, end: now, groupBy: 'month' }),
        dashboardService.getAttendancesData({ start: twelveMonthsAgo, end: now, groupBy: 'month' }),
        dashboardService.getSalesData({ start: twelveMonthsAgo, end: now, groupBy: 'month' })
      ])

      const visitorsMap = new Map(visitorsData.map(d => [d.label, d.value]))
      const leadsMap = new Map(leadsData.map(d => [d.label, d.value]))
      const appointmentsMap = new Map(appointmentsData.map(d => [d.label, d.value]))
      const attendancesMap = new Map(attendancesData.map(d => [d.label, d.value]))
      const salesMap = new Map(salesData.map(d => [d.label, d.value]))

      const allDates = new Set([
        ...visitorsData.map(d => d.label),
        ...leadsData.map(d => d.label),
        ...appointmentsData.map(d => d.label),
        ...attendancesData.map(d => d.label),
        ...salesData.map(d => d.label)
      ])
      const sortedDates = Array.from(allDates).sort()

      if (analyticsEnabled) {
        const visitorsLeads = sortedDates.map(date => ({
          label: date,
          value: visitorsMap.get(date) || 0,
          value2: leadsMap.get(date) || 0
        }))
        setVisitorsLeadsData(visitorsLeads)
      } else {
        setVisitorsLeadsData([])
      }

      const leadsAppointments = sortedDates.map(date => ({
        label: date,
        value: leadsMap.get(date) || 0,
        value2: appointmentsMap.get(date) || 0
      }))
      setLeadsAppointmentsData(leadsAppointments)

      const appointmentsAttendances = sortedDates.map(date => ({
        label: date,
        value: appointmentsMap.get(date) || 0,
        value2: attendancesMap.get(date) || 0
      }))
      setAppointmentsAttendancesData(appointmentsAttendances)

      const attendancesSales = sortedDates.map(date => ({
        label: date,
        value: attendancesMap.get(date) || 0,
        value2: salesMap.get(date) || 0
      }))
      setAttendancesSalesData(attendancesSales)

      const appointmentsSales = sortedDates.map(date => ({
        label: date,
        value: appointmentsMap.get(date) || 0,
        value2: salesMap.get(date) || 0
      }))
      setAppointmentsSalesData(appointmentsSales)

      setExtendedChartDataLoaded(true)
    } catch (error) {
      // TODO: Integrate logging service
      setExtendedChartDataLoaded(false)
    } finally {
      setExtendedChartDataLoading(false)
    }
  }, [analyticsEnabled, extendedChartDataLoaded, extendedChartDataLoading, user])

  React.useEffect(() => {
    setExtendedChartDataLoaded(false)
    setExtendedChartDataLoading(false)
    setVisitorsLeadsData([])
    setLeadsAppointmentsData([])
    setAppointmentsAttendancesData([])
    setAttendancesSalesData([])
    setAppointmentsSalesData([])
  }, [analyticsEnabled, dateRange.start, dateRange.end])

  React.useEffect(() => {
    if (selectedChartView === 'revenue-spend') return
    if (!analyticsEnabled && selectedChartView === 'visitors-leads') return
    void loadExtendedChartData()
  }, [selectedChartView, analyticsEnabled, loadExtendedChartData])

  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      setLoading(true)
      try {
        // Calcular últimos 12 meses para los gráficos
        const now = new Date()
        const twelveMonthsAgo = new Date(now)
        twelveMonthsAgo.setMonth(now.getMonth() - 12)

        const trafficPromise = analyticsEnabled
          ? dashboardService.getTrafficSources({
              start: dateRange.start,
              end: dateRange.end
            })
          : Promise.resolve<{ name: string; value: number; color: string }[]>([])

        const [metricsData, chartDataResponse, trafficSourcesData, funnelDataResponse] = await Promise.all([
          dashboardService.getDashboardMetrics({
            start: dateRange.start,
            end: dateRange.end
          }),
          dashboardService.getFinancialChart({
            start: twelveMonthsAgo,
            end: now,
            scope: financialScope
          }),
          trafficPromise,
          dashboardService.getFunnelData({
            start: dateRange.start,
            end: dateRange.end,
            scope: 'all'
          })
        ])

        setMetrics(metricsData)
        setChartData(chartDataResponse)
        setTrafficSources(analyticsEnabled ? trafficSourcesData : [])
        setFunnelData(funnelDataResponse)
      } catch (error) {
        // TODO: add logging service
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [analyticsEnabled, dateRange, financialScope, user])

  useEffect(() => {
    if (!user) return

    let mounted = true

    const loadOperationalSnapshot = async () => {
      setOperationsLoading(true)

      const from = formatDateToISO(dateRange.start)
      const to = formatEndDateToISO(dateRange.end)
      const now = new Date()
      const twoWeeksFromNow = new Date(now)
      twoWeeksFromNow.setDate(now.getDate() + 14)

      const appointmentsPromise = locationId && accessToken
        ? calendarsService.getEvents(
            locationId,
            now.getTime(),
            twoWeeksFromNow.getTime(),
            accessToken
          )
        : Promise.resolve<CalendarEvent[]>([])

      try {
        const [transactionsData, contactsResult, appointmentsData] = await Promise.all([
          transactionsService.getTransactions(from, to),
          reportsService.getContactsList({
            from,
            to,
            type: 'interesados',
            scope: 'all'
          }).then(result => result.contacts).catch(() => [] as ContactListItem[]),
          appointmentsPromise
        ])

        if (!mounted) return

        const sortedTransactions = [...transactionsData]
          .sort((a, b) => getTimeValue(getTransactionDate(b)) - getTimeValue(getTransactionDate(a)))
          .slice(0, 5)

        const sortedContacts = [...contactsResult]
          .sort((a, b) => getTimeValue(getContactCreatedAt(b)) - getTimeValue(getContactCreatedAt(a)))
          .slice(0, 5)

        const nowTime = now.getTime()
        const sortedAppointments = [...appointmentsData]
          .filter(appointment => isUpcomingAppointment(appointment, nowTime))
          .sort((a, b) => getTimeValue(a.startTime) - getTimeValue(b.startTime))
          .slice(0, 5)

        setRecentTransactions(sortedTransactions)
        setRecentContacts(sortedContacts)
        setUpcomingAppointments(sortedAppointments)
      } catch {
        if (!mounted) return
        setRecentTransactions([])
        setRecentContacts([])
        setUpcomingAppointments([])
      } finally {
        if (mounted) {
          setOperationsLoading(false)
        }
      }
    }

    loadOperationalSnapshot()

    return () => {
      mounted = false
    }
  }, [accessToken, dateRange.end, dateRange.start, locationId, user])

  // useEffect separado solo para el funnel (no recarga toda la página)
  React.useEffect(() => {
    const loadFunnelData = async () => {
      setFunnelLoading(true)
      try {
        const funnelDataResponse = await dashboardService.getFunnelData({
          start: dateRange.start,
          end: dateRange.end,
          scope: funnelScope
        })
        setFunnelData(funnelDataResponse)
      } catch (error) {
        // Error silencioso
      } finally {
        setFunnelLoading(false)
      }
    }

    loadFunnelData()
  }, [funnelScope, dateRange])

  const renderOperationsLoadingRows = (count = 4) => (
    Array.from({ length: count }).map((_, index) => (
      <div key={`operations-loading-${index}`} className="flex items-center justify-between gap-4 border-b border-[rgba(148,163,184,0.12)] py-3 last:border-b-0">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-[color-mix(in_srgb,var(--color-text-primary)_9%,transparent)]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[color-mix(in_srgb,var(--color-text-primary)_7%,transparent)]" />
        </div>
        <div className="h-6 w-20 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--color-text-primary)_7%,transparent)]" />
      </div>
    ))
  )

  const renderEmptyOperationsState = (message: string) => (
    <div className="flex min-h-[156px] items-center justify-center rounded-xl border border-dashed border-[rgba(148,163,184,0.2)] px-4 text-center text-sm text-[var(--color-text-tertiary)]">
      {message}
    </div>
  )

  const getStatusClassName = (status?: string | null) => {
    const normalized = status?.toLowerCase()

    if (normalized === 'paid' || normalized === 'confirmed' || normalized === 'showed') {
      return 'border-[rgba(16,185,129,0.34)] text-[var(--color-status-success)]'
    }

    if (normalized === 'pending' || normalized === 'sent' || normalized === 'partial' || normalized === 'rescheduled') {
      return 'border-[rgba(245,158,11,0.34)] text-[var(--color-status-warning)]'
    }

    if (normalized === 'failed' || normalized === 'overdue' || normalized === 'refunded' || normalized === 'void' || normalized === 'cancelled' || normalized === 'noshow') {
      return 'border-[rgba(220,38,38,0.34)] text-[var(--color-status-error)]'
    }

    return 'border-[rgba(148,163,184,0.22)] text-[var(--color-text-secondary)]'
  }

  if (loading || !metrics) {
    return <Loading message="Cargando dashboard..." />
  }

  return (
    <>
      <PageContainer>
      <div data-ristak-dashboard className="flex flex-col" style={{ gap: '18px' }}>
        <div data-dashboard-topbar className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
          <div data-dashboard-heading className="flex flex-col items-start gap-1">
            <h1 className="m-0 text-[24px] font-bold text-[var(--color-text-primary)]">Dashboard</h1>
          </div>
          <DateRangePicker
            startDate={formatDateToISO(dateRange.start)}
            endDate={formatDateToISO(dateRange.end)}
            onChange={(start, end) => setDateRange({
              start: parseLocalDateString(start),
              end: parseLocalDateString(end),
              preset: 'custom'
            })}
          />
        </div>

        <div data-dashboard-kpi-grid className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
          <KpiCard
            title="Ingresos Netos"
            value={formatCurrency(metrics.ingresosNetos.value)}
            delta={metrics.ingresosNetos.variation}
            deltaLabel="vs periodo anterior"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <KpiCard
          title="Gastos de Publicidad"
          value={formatCurrency(metrics.gastosPublicidad.value)}
          delta={metrics.gastosPublicidad.variation}
          deltaLabel="vs periodo anterior"
          icon={<Megaphone className="w-5 h-5" />}
        />
        <KpiCard
          title="Ganancia Bruta"
          value={formatCurrency(metrics.gananciaBruta.value)}
          delta={metrics.gananciaBruta.variation}
          deltaLabel="vs periodo anterior"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <KpiCard
          title="Retorno de Inversión"
          value={formatRoas(metrics.roas.value)}
          delta={metrics.roas.variation}
          deltaLabel="vs periodo anterior"
          icon={<Target className="w-5 h-5" />}
        />
        <KpiCard
          title="Costos Totales"
          value={formatCurrency(metrics.totalCostos.value)}
          delta={metrics.totalCostos.variation}
          deltaLabel="vs periodo anterior"
          icon={<Receipt className="w-5 h-5" />}
        />
        <KpiCard
          title="Ganancia Neta"
          value={formatCurrency(metrics.gananciaNeta.value)}
          delta={metrics.gananciaNeta.variation}
          deltaLabel="vs periodo anterior"
          icon={<Wallet className="w-5 h-5" />}
        />
        <KpiCard
          title="Reembolsos"
          value={formatCurrency(metrics.reembolsos.value)}
          delta={metrics.reembolsos.variation}
          deltaLabel="vs periodo anterior"
          icon={<RotateCcw className="w-5 h-5" />}
        />
        <KpiCard
          title="Pagos totales promedio"
          value={formatCurrency(metrics.ltvPromedio.value)}
          delta={metrics.ltvPromedio.variation}
          deltaLabel="vs periodo anterior"
          icon={<Users className="w-5 h-5" />}
        />
        </div>

        <Card data-dashboard-chart-card variant="glass" className="space-y-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                {activeChartLabel}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Últimos 12 meses</p>
            </div>
            <div className="flex items-end gap-4">
              {selectedChartView === 'revenue-spend' && (
                <div className={funnelStyles.scopeSelector} data-ristak-scope-selector>
                  {financialScopeOptions.map(({ value, label, icon: Icon, description }) => {
                    const button = (
                      <button
                        className={`${funnelStyles.scopeButton} ${financialScope === value ? funnelStyles.scopeButtonActive : ''}`}
                        data-ristak-scope-button
                        data-active={financialScope === value ? 'true' : undefined}
                        onClick={() => setFinancialScope(value)}
                      >
                        <Icon size={13} />
                        {label}
                      </button>
                    )

                    return (
                      <HelpTooltip key={value} content={description}>
                        {button}
                      </HelpTooltip>
                    )
                  })}
                </div>
              )}
              <ViewSelector
                options={chartViewOptions}
                value={selectedChartView}
                onChange={(value) => setSelectedChartView(value as ChartView)}
              />
            </div>
          </div>
          <div className="relative w-full" style={{ minHeight: chartHeight, height: chartHeight }}>
            {isChartLoading ? (
              <div data-ristak-chart-empty className="flex h-full items-center justify-center rounded-xl border border-[rgba(148,163,184,0.18)] bg-[color-mix(in_srgb,var(--color-background-glass) 82%, transparent)] text-sm text-[var(--color-text-tertiary)]">
                Cargando datos del gráfico...
              </div>
            ) : hasChartData ? (
              <AreaChart
                data={chartConfig.data}
                height={chartHeight}
                showGrid
                color={chartConfig.color}
                color2={chartConfig.color2}
                formatValue={chartConfig.formatValue}
                formatTooltipValue={chartConfig.formatTooltipValue}
                showLegend
                legendLabels={{ label1: chartConfig.label1, label2: chartConfig.label2 }}
              />
            ) : (
              <div data-ristak-chart-empty className="flex h-full items-center justify-center rounded-xl border border-[rgba(148,163,184,0.18)] bg-[color-mix(in_srgb,var(--color-background-glass) 82%, transparent)] text-sm text-[var(--color-text-tertiary)]">
                Sin datos disponibles
              </div>
            )}
          </div>
        </Card>

        <div className={chartsGridClass}>
          <ConversionFunnelChart
            data={funnelChartData}
            loading={funnelLoading}
            showVisitors={analyticsEnabled}
            scope={funnelScope}
            onScopeChange={setFunnelScope}
            onStageClick={handleFunnelStageClick}
          />
          {analyticsEnabled && (
            <TrafficSourcesChart
              data={trafficSources}
              loading={loading}
            />
          )}
        </div>

        <section data-dashboard-operations className="grid gap-4 xl:grid-cols-3">
          <Card variant="glass" className="flex min-h-[320px] flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[var(--color-text-tertiary)]">
                  <Banknote className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.08em]">Pagos</span>
                </div>
                <h3 className="m-0 text-lg font-semibold text-[var(--color-text-primary)]">Últimos pagos</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Movimientos del rango activo</p>
              </div>
              <Link
                to="/transactions"
                className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Ver
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex-1">
              {operationsLoading ? renderOperationsLoadingRows() : recentTransactions.length > 0 ? (
                <div className="divide-y divide-[rgba(148,163,184,0.12)]">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {transaction.contactName || transaction.email || 'Cliente sin nombre'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                          {formatDate(getTransactionDate(transaction), { includeYear: true })}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {formatCurrency(transaction.amount)}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getStatusClassName(transaction.status)}`}>
                          {TRANSACTION_STATUS_LABELS[transaction.status] ?? transaction.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                renderEmptyOperationsState('Sin pagos registrados en este rango.')
              )}
            </div>
          </Card>

          <Card variant="glass" className="flex min-h-[320px] flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[var(--color-text-tertiary)]">
                  <CalendarClock className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.08em]">Citas</span>
                </div>
                <h3 className="m-0 text-lg font-semibold text-[var(--color-text-primary)]">Próximas citas</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Agenda de los siguientes 14 días</p>
              </div>
              <Link
                to="/appointments"
                className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Ver
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex-1">
              {operationsLoading ? renderOperationsLoadingRows() : upcomingAppointments.length > 0 ? (
                <div className="divide-y divide-[rgba(148,163,184,0.12)]">
                  {upcomingAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {getAppointmentTitle(appointment)}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatLocalDateTime(appointment.startTime)}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getStatusClassName(appointment.appointmentStatus)}`}>
                        {APPOINTMENT_STATUS_LABELS[appointment.appointmentStatus] ?? appointment.appointmentStatus}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                renderEmptyOperationsState(locationId && accessToken ? 'No hay citas próximas en los siguientes 14 días.' : 'Conecta HighLevel para ver próximas citas aquí.')
              )}
            </div>
          </Card>

          <Card variant="glass" className="flex min-h-[320px] flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[var(--color-text-tertiary)]">
                  <UserPlus className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.08em]">Contactos</span>
                </div>
                <h3 className="m-0 text-lg font-semibold text-[var(--color-text-primary)]">Nuevos contactos</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Registros recientes del rango activo</p>
              </div>
              <Link
                to="/contacts"
                className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Ver
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex-1">
              {operationsLoading ? renderOperationsLoadingRows() : recentContacts.length > 0 ? (
                <div className="divide-y divide-[rgba(148,163,184,0.12)]">
                  {recentContacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {getContactName(contact)}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">
                          {contact.email || contact.phone || 'Sin datos de contacto'}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right">
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {formatDate(getContactCreatedAt(contact), { includeYear: true })}
                        </span>
                        {contact.ltv > 0 && (
                          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                            {formatCurrency(contact.ltv)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                renderEmptyOperationsState('Sin contactos nuevos en este rango.')
              )}
            </div>
          </Card>
        </section>
      </div>
      </PageContainer>

      <ContactDetailsModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={contactModalTitle}
        subtitle={contactModalSubtitle}
        data={contactModalContacts}
        loading={contactModalLoading}
        type={contactModalType}
      />

      <VisitorDetailsModal
        isOpen={visitorsModalOpen}
        onClose={() => setVisitorsModalOpen(false)}
        title={visitorsModalTitle}
        subtitle={visitorsModalSubtitle}
        data={visitorsModalData}
        loading={visitorsModalLoading}
      />
    </>
  )
}

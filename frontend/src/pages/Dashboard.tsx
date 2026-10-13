import './Dashboard.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, ChevronDown, EllipsisVertical, Gauge, History, LogOut, Package, Settings, TrendingUp, Users } from 'lucide-react'
import { apiRequest } from '../utils/api'

type IconProps = { icon: LucideIcon; className?: string }
type DashboardSummary = {
  total_products: number
  model_accuracy: number | null
  best_seller: string | null
  monthly_sales: { year: number; month: number; actual: number | null; predicted: number | null }[]
  top_demand: { product_code: string; predicted_quantity: number }[]
}
type SummaryCardData = { label: string; value: string; icon: LucideIcon; tone: string }

function AssetIcon({ icon: Icon, className = '' }: IconProps) {
  return <Icon className={`asset-icon ${className}`} aria-hidden="true" />
}

const navItems = [
  { label: 'Dashboard', icon: Gauge, path: '/dashboard' },
  { label: 'Forecast', icon: TrendingUp, path: '/forecast' },
  { label: 'Inventory', icon: Package, path: '/inventory/sales' },
  { label: 'User', icon: Users, path: '/users' },
  { label: 'Settings', icon: Settings, path: '/settings' },
  { label: 'History', icon: History, path: '/history' },
]

export function Sidebar({ activeLabel = 'Dashboard', activeSubLabel }: { activeLabel?: string; activeSubLabel?: string }) {
  const navigate = useNavigate()
  // tambahin biar ada authorization 
  const userData = localStorage.getItem("user") ?? sessionStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;
  const sidebarItems = user?.role === "super_user"
    ? navItems
    : navItems.filter(
      (item) =>
        item.label === "Dashboard" ||
        item.label === "Forecast" ||
        item.label === "History" 
    )
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h1>Sales Forecast</h1>
        <nav aria-label="Navigasi utama">
          {sidebarItems.map((item) => item.label === 'Inventory' && activeLabel === 'Inventory' ? (
            <div className="nav-group" key={item.label}>
              <button className="nav-item active nav-parent" type="button" onClick={() => navigate(item.path)}><span className="nav-item-content"><AssetIcon icon={item.icon} /><span>{item.label}</span></span><ChevronDown className="nav-chevron" aria-hidden="true" /></button>
              <div className="nav-submenu"><button className={`nav-subitem${activeSubLabel === 'Data Penjualan' ? ' active' : ''}`} type="button" onClick={() => navigate('/inventory/sales')}>Data Penjualan</button><button className={`nav-subitem${activeSubLabel === 'Data Produk' ? ' active' : ''}`} type="button" onClick={() => navigate('/inventory/products')}>Data Produk</button></div>
            </div>
          ) : (
            <button className={`nav-item${item.label === activeLabel ? ' active' : ''}`} key={item.label} type="button" onClick={() => navigate(item.path)}><AssetIcon icon={item.icon} /><span>{item.label}</span></button>
          ))}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" type="button" onClick={() => navigate('/login')}>
          <AssetIcon icon={LogOut} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

function SummaryCard({ card }: { card: SummaryCardData }) {
  return (
    <article className="summary-card">
      <div className="summary-card-top">
        <div className={`summary-icon ${card.tone}`}><AssetIcon icon={card.icon} /></div>
      </div>
      <div className="summary-copy">
        <span>{card.label}</span>
        <strong>{card.value}</strong>
      </div>
    </article>
  )
}

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' })

function formatQuantity(value: number) {
  return numberFormat.format(value)
}

function getForecastChartOptions(categories: string[]): ApexOptions {
  return {
    chart: {
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      animations: { enabled: true, speed: 500 },
    },
    colors: ['#c8c5d3', '#433f93'],
    stroke: { curve: 'smooth', width: [2, 3], dashArray: [0, 0] },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 95, 100] },
    },
    markers: { size: 0, hover: { size: 5 } },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: '#ecebf2',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      padding: { left: 8, right: 8 },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#474551', fontSize: '11px', fontWeight: 700 } },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      tickAmount: 4,
      labels: {
        formatter: (value) => new Intl.NumberFormat('id-ID').format(Math.round(value)),
        style: { colors: '#808080', fontSize: '11px' },
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (value) => (value === null ? '—' : `${formatQuantity(value)} unit`) },
    },
  }
}

function ForecastChart({ summary, isLoading }: { summary: DashboardSummary | null; isLoading: boolean }) {
  const categories = summary?.monthly_sales.map(({ year, month }) =>
    monthFormat.format(new Date(year, month - 1, 1)).toLocaleUpperCase('id-ID'),
  ) ?? []
  const series = [
    { name: 'Aktual', data: summary?.monthly_sales.map((item) => item.actual) ?? [] },
    { name: 'Prediksi', data: summary?.monthly_sales.map((item) => item.predicted) ?? [] },
  ]

  return (
    <section className="panel chart-panel">
      <div className="panel-heading chart-heading">
        <div>
          <h2>Penjualan Aktual vs Hasil Prediksi</h2>
          <p>Penjualan aktual 6 bulan terakhir dan proyeksi 6 bulan ke depan</p>
        </div>
        <div className="chart-actions">
          <span><i className="legend-dot actual" />Aktual</span>
          <span><i className="legend-dot prediction" />Prediksi</span>
          <button type="button" aria-label="Opsi grafik"><AssetIcon icon={EllipsisVertical} /></button>
        </div>
      </div>
      <div className="chart-area" aria-label="Grafik penjualan aktual dan prediksi">
        {categories.length > 0
          ? <Chart options={getForecastChartOptions(categories)} series={series} type="area" height={300} />
          : <p className="dashboard-empty">{isLoading ? 'Memuat data penjualan...' : 'Data penjualan belum tersedia.'}</p>}
      </div>
    </section>
  )
}

function DemandTable({ rows, isLoading }: { rows: DashboardSummary['top_demand']; isLoading: boolean }) {
  const highestQuantity = rows[0]?.predicted_quantity ?? 0

  return (
    <section className="panel demand-panel">
      <div className="table-heading"><h2>Proyeksi Permintaan Tertinggi</h2></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>PRODUK</th><th>VOLUME (UNIT)</th><th>DARI PROYEKSI TERTINGGI</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const relativeVolume = highestQuantity > 0
                ? Math.round((row.predicted_quantity / highestQuantity) * 100)
                : 0

              return (
                <tr key={row.product_code}>
                  <th scope="row">{row.product_code}</th>
                  <td>{formatQuantity(row.predicted_quantity)}</td>
                  <td><span>{relativeVolume}%</span><b className="confidence"><i style={{ width: `${relativeVolume}%` }} /></b></td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td className="dashboard-empty" colSpan={3}>
                  {isLoading ? 'Memuat proyeksi...' : 'Belum ada proyeksi dari model aktif.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const loadSummary = async () => {
      try {
        const result = await apiRequest<DashboardSummary>('/api/dashboard/summary', {
          signal: controller.signal,
        })
        setSummary(result)
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : 'Ringkasan dashboard gagal dimuat.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadSummary()
    return () => controller.abort()
  }, [])

  const summaryCards: SummaryCardData[] = [
    {
      label: 'Total Produk',
      value: summary ? formatQuantity(summary.total_products) : '—',
      icon: Package,
      tone: 'products',
    },
    {
      label: 'Akurasi Model Saat Ini',
      value: summary?.model_accuracy === null || summary?.model_accuracy === undefined
        ? '—'
        : `${summary.model_accuracy.toFixed(1)}%`,
      icon: Gauge,
      tone: 'accuracy',
    },
    {
      label: 'Produk Terlaris',
      value: summary?.best_seller ?? '—',
      icon: BarChart3,
      tone: 'best-seller',
    },
  ]

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-main">
        <header className="topbar" />
        <main className="dashboard-content">
          <header className="page-heading">
            <div><h2>Ringkasan</h2><p>ringkasan prediksi penjualan untuk periode berjalan.</p></div>
          </header>
          {errorMessage && <p className="dashboard-feedback" role="alert">{errorMessage}</p>}
          {isLoading && <p className="dashboard-feedback" role="status">Memuat ringkasan dashboard...</p>}
          <section className="summary-grid">{summaryCards.map((card) => <SummaryCard card={card} key={card.label} />)}</section>
          <ForecastChart summary={summary} isLoading={isLoading} />
          <DemandTable rows={summary?.top_demand ?? []} isLoading={isLoading} />
        </main>
      </div>
    </div>
  )
}

export default Dashboard
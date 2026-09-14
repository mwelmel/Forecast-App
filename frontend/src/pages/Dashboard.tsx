import './Dashboard.css'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, ChevronDown, EllipsisVertical, Gauge, History, LogOut, Package, Settings, TrendingUp, Users, WalletCards } from 'lucide-react'

type IconProps = { icon: LucideIcon; className?: string }

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

const summaryCards = [
  { label: 'Total Produk', value: '1,284', icon: Package, tone: 'products', change: '2.4%', changeIcon: TrendingUp },
  { label: 'Akurasi Model Saat Ini', value: '94.2%', icon: Gauge, tone: 'accuracy', change: '0.0%', changeIcon: WalletCards },
  { label: 'Produk Terlaris', value: 'PRD00257', icon: BarChart3, tone: 'best-seller' },
]

const demandRows = [
  { product: 'PRD00001', volume: '4,250', confidence: 96 },
  { product: 'PRD00345', volume: '3,120', confidence: 92 },
  { product: 'PRD00234', volume: '2,840', confidence: 88 },
  { product: 'PRD00129', volume: '850', confidence: 94 },
]

export function Sidebar({ activeLabel = 'Dashboard', activeSubLabel }: { activeLabel?: string; activeSubLabel?: string }) {
  const navigate = useNavigate()
  const sidebarItems = navItems
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

function SummaryCard({ card }: { card: (typeof summaryCards)[number] }) {
  return (
    <article className="summary-card">
      <div className="summary-card-top">
        <div className={`summary-icon ${card.tone}`}><AssetIcon icon={card.icon} /></div>
        {card.change && (
          <span className={`change-badge ${card.tone}`}>
            <AssetIcon icon={card.changeIcon!} />
            {card.change}
          </span>
        )}
      </div>
      <div className="summary-copy">
        <span>{card.label}</span>
        <strong>{card.value}</strong>
      </div>
    </article>
  )
}

function ForecastChart() {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN']

  return (
    <section className="panel chart-panel">
      <div className="panel-heading chart-heading">
        <div>
          <h2>Penjualan Aktual vs Hasil Prediksi</h2>
          <p>Komparasi performa historis dengan model prediktif (YTD)</p>
        </div>
        <div className="chart-actions">
          <span><i className="legend-dot actual" />Aktual</span>
          <span><i className="legend-dot prediction" />Prediksi</span>
          <button type="button" aria-label="Opsi grafik"><AssetIcon icon={EllipsisVertical} /></button>
        </div>
      </div>
      <div className="chart-area" aria-label="Grafik penjualan aktual dan prediksi">
        <div className="chart-grid"><i /><i /><i /><i /><i /></div>
        <div className="chart-shape prediction-shape" />
        <div className="chart-shape actual-shape" />
        <div className="chart-months">{months.map((month) => <span key={month}>{month}</span>)}</div>
      </div>
    </section>
  )
}

function DemandTable() {
  return (
    <section className="panel demand-panel">
      <div className="table-heading"><h2>Proyeksi Permintaan Tertinggi</h2></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>PRODUK</th><th>VOLUME (UNIT)</th><th>KEPERCAYAAN MODEL</th></tr></thead>
          <tbody>
            {demandRows.map((row) => (
              <tr key={row.product}>
                <th scope="row">{row.product}</th>
                <td>{row.volume}</td>
                <td><span>{row.confidence}%</span><b className="confidence"><i style={{ width: `${row.confidence}%` }} /></b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Dashboard() {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-main">
        <header className="topbar" />
        <main className="dashboard-content">
          <header className="page-heading">
            <div><h2>Ringkasan</h2><p>ringkasan prediksi penjualan untuk periode berjalan.</p></div>
          </header>
          <section className="summary-grid">{summaryCards.map((card) => <SummaryCard card={card} key={card.label} />)}</section>
          <ForecastChart />
          <DemandTable />
        </main>
      </div>
    </div>
  )
}

export default Dashboard
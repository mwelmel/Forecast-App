import './Dashboard.css'

const assets = {
  products: 'https://www.figma.com/api/mcp/asset/ba7404d0-8b34-4778-8ad0-2b959201c80d.svg',
  increase: 'https://www.figma.com/api/mcp/asset/ad6a414a-0970-41c5-b66e-80144c78c832.svg',
  accuracy: 'https://www.figma.com/api/mcp/asset/37b34c4d-9890-4503-9076-fbde680f12aa.svg',
  neutral: 'https://www.figma.com/api/mcp/asset/e119630c-dd54-48da-9c02-803beb1a95fc.svg',
  bestSeller: 'https://www.figma.com/api/mcp/asset/b3177021-47ec-4255-a172-da0fb5671164.svg',
  more: 'https://www.figma.com/api/mcp/asset/6d5a7189-ef9b-43db-a685-3512439ec7a9.svg',
  chartActual: 'https://www.figma.com/api/mcp/asset/2599b1ef-3b2e-4dd3-b78c-66d65e18fe2b.svg',
  chartPrediction: 'https://www.figma.com/api/mcp/asset/3cae1edf-7abf-4ea4-a407-fd58758829e5.svg',
  dashboard: 'https://www.figma.com/api/mcp/asset/de65d579-af54-4240-9883-ed7df4bed57c.svg',
  forecast: 'https://www.figma.com/api/mcp/asset/f4ee107d-2446-4ee6-b4e4-5a02496ac9fc.svg',
  inventory: 'https://www.figma.com/api/mcp/asset/5ddcb0cb-2aee-4fa4-8973-5c494992f1fc.svg',
  user: 'https://www.figma.com/api/mcp/asset/86b2fecb-16e7-4b27-8e83-de15fd2520e4.svg',
  settings: 'https://www.figma.com/api/mcp/asset/a85bffac-b8c5-4693-b77d-968416be2222.svg',
  history: 'https://www.figma.com/api/mcp/asset/2352ff7d-8442-4ff5-b39d-865bd287dc95.svg',
  logout: 'https://www.figma.com/api/mcp/asset/5ce0da35-1a8c-4035-82d0-4d913c8d0b4c.svg',
}

type IconProps = { src: string; className?: string }

function AssetIcon({ src, className = '' }: IconProps) {
  return <img className={`asset-icon ${className}`} src={src} alt="" />
}

const navItems = [
  { label: 'Dashboard', icon: assets.dashboard, active: true },
  { label: 'Forecast', icon: assets.forecast },
  { label: 'Inventory', icon: assets.inventory },
  { label: 'User', icon: assets.user },
  { label: 'Settings', icon: assets.settings },
  { label: 'History', icon: assets.history },
]

const summaryCards = [
  { label: 'Total Produk', value: '1,284', icon: assets.products, tone: 'products', change: '2.4%', changeIcon: assets.increase },
  { label: 'Akurasi Model Saat Ini', value: '94.2%', icon: assets.accuracy, tone: 'accuracy', change: '0.0%', changeIcon: assets.neutral },
  { label: 'Produk Terlaris', value: 'PRD00257', icon: assets.bestSeller, tone: 'best-seller' },
]

const demandRows = [
  { product: 'PRD00001', volume: '4,250', confidence: 96 },
  { product: 'PRD00345', volume: '3,120', confidence: 92 },
  { product: 'PRD00234', volume: '2,840', confidence: 88 },
  { product: 'PRD00129', volume: '850', confidence: 94 },
]

export function Sidebar({ activeLabel = 'Dashboard', activeSubLabel, variant = 'default' }: { activeLabel?: string; activeSubLabel?: string; variant?: 'default' | 'history' }) {
  const sidebarItems = variant === 'history' ? navItems.map((item, index) => ({ ...item, label: ['Overview', 'Sales Trends', 'Inventory', 'Team Performance', 'Settings', 'History'][index] })) : navItems
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h1>Sales Forecast</h1>
        <nav aria-label="Navigasi utama">
          {sidebarItems.map((item) => item.label === 'Inventory' && activeLabel === 'Inventory' ? (
            <div className="nav-group" key={item.label}>
              <button className="nav-item active nav-parent" type="button"><span className="nav-item-content"><AssetIcon src={item.icon} /><span>{item.label}</span></span><span className="nav-chevron">⌄</span></button>
              <div className="nav-submenu"><button className={`nav-subitem${activeSubLabel === 'Data Penjualan' ? ' active' : ''}`} type="button">Data Penjualan</button><button className={`nav-subitem${activeSubLabel === 'Data Produk' ? ' active' : ''}`} type="button">Data Produk</button></div>
            </div>
          ) : (
            <button className={`nav-item${item.label === activeLabel ? ' active' : ''}`} key={item.label} type="button"><AssetIcon src={item.icon} /><span>{item.label}</span></button>
          ))}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" type="button">
          <AssetIcon src={assets.logout} />
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
        <div className={`summary-icon ${card.tone}`}><AssetIcon src={card.icon} /></div>
        {card.change && (
          <span className={`change-badge ${card.tone}`}>
            <AssetIcon src={card.changeIcon!} />
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
          <button type="button" aria-label="Opsi grafik"><AssetIcon src={assets.more} /></button>
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
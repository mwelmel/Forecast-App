import { Sidebar } from './Dashboard'
import './Forecasting.css'
import { CalendarDays, ChevronDown, Filter, Package } from 'lucide-react'


const forecastRows = [
  { month: 'Juli 2024', product: 'PRD0001', unit: '2HBLE', sales: '124' },
  { month: 'Agustus 2024', product: 'PRD0235', unit: '2HBLE', sales: '56' },
  { month: 'September 2024', product: 'PRD0200', unit: '2HBLE', sales: '45' },
  { month: 'Oktober 2024', product: 'PRD0124', unit: '2HBLE', sales: '31', emphasis: true },
  { month: 'November 2024', product: 'PRD0005', unit: '2HBLE', sales: '980', emphasis: true },
]

function FilterBar() {
  return (
    <section className="forecast-filter" aria-label="Filter prediksi">
      <div className="filter-fields">
        <button className="filter-select" type="button">
          <Package aria-hidden="true" />
          <span>Semua Produk</span>
          <ChevronDown className="filter-chevron" aria-hidden="true" />
        </button>
        <button className="filter-date" type="button">
          <CalendarDays aria-hidden="true" />
          <span>Juli 2024 - Des 2024</span>
        </button>
      </div>
      <button className="apply-filter" type="button">
        <Filter aria-hidden="true" />
        <span>Terapkan Filter</span>
      </button>
    </section>
  )
}

function ForecastTable() {
  return (
    <section className="forecast-table-panel">
      <h2>Detail Prediksi</h2>
      <div className="forecast-table-scroll">
        <table className="forecast-table">
          <colgroup><col /><col /><col /><col /></colgroup>
          <thead><tr><th>BULAN</th><th>PRODUK</th><th>UNIT BISNIS</th><th>ESTIMASI PENJUALAN</th></tr></thead>
          <tbody>
            {forecastRows.map((row) => (
              <tr className={row.emphasis ? 'emphasis' : ''} key={row.month}>
                <th scope="row">{row.month}</th>
                <td>{row.product}</td>
                <td>{row.unit}</td>
                <td>{row.sales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Forecasting() {
  return (
    <div className="forecasting-shell">
      <Sidebar activeLabel="Forecast" />
      <div className="forecasting-main">
        <header className="forecasting-topbar" />
        <main className="forecasting-content">
          <FilterBar />
          <ForecastTable />
        </main>
      </div>
    </div>
  )
}

export default Forecasting
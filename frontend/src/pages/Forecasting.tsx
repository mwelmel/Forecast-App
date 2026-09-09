import { Sidebar } from './Dashboard'
import './Forecasting.css'

const filterAssets = {
  product: 'https://www.figma.com/api/mcp/asset/f9a8d8c2-3c92-46a2-9a68-182445ea51d9.svg',
  chevron: 'https://www.figma.com/api/mcp/asset/a0a89952-db9e-46d0-a9b7-4aa194227371.svg',
  calendar: 'https://www.figma.com/api/mcp/asset/d086f477-e670-4448-a5c1-36120ce4e90c.svg',
  filter: 'https://www.figma.com/api/mcp/asset/1dc55ab1-4da9-4a6f-aa0b-9221074c3f47.svg',
}

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
          <img src={filterAssets.product} alt="" />
          <span>Semua Produk</span>
          <img className="filter-chevron" src={filterAssets.chevron} alt="" />
        </button>
        <button className="filter-date" type="button">
          <img src={filterAssets.calendar} alt="" />
          <span>Juli 2024 - Des 2024</span>
        </button>
      </div>
      <button className="apply-filter" type="button">
        <img src={filterAssets.filter} alt="" />
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
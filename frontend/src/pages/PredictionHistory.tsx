import { useState } from 'react'
import { Sidebar } from './Dashboard'
import './PredictionHistory.css'

const historyRows = [
  { period: 'Jan 2024', product: 'PRD-001', predicted: '10', actual: '4', difference: '-6', status: 'Under-predicted', tone: 'under' },
  { period: 'Jan 2024', product: 'PRD-042', predicted: '240', actual: '500', difference: '300', status: 'Over-predicted', tone: 'over' },
  { period: 'Feb 2024', product: 'PRD-001', predicted: '50', actual: '50', difference: '-', status: 'Highly Accurate', tone: 'accurate' },
  { period: 'Feb 2024', product: 'PRD-105', predicted: '45', actual: '95', difference: '50', status: 'Over-predicted', tone: 'over' },
  { period: 'Mar 2024', product: 'PRD-001', predicted: '120', actual: '0', difference: '-120', status: 'Under-predicted', tone: 'under' },
]

function PeriodPicker() {
  const [open, setOpen] = useState(true)
  const [period, setPeriod] = useState('Tahun 2024')
  const years = ['Tahun 2024', 'Tahun 2023', 'Tahun 2022']
  return <div className="period-picker"><label>Periode Waktu</label><button type="button" className="period-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span>{period}</span><span className="select-chevron">⌄</span></button>{open && <div className="period-menu" role="listbox">{years.map((year) => <button className={year === period ? 'selected' : ''} type="button" role="option" aria-selected={year === period} key={year} onClick={() => { setPeriod(year); setOpen(false) }}>{year}{year === period && <span>✓</span>}</button>)}</div>}</div>
}

function HistoryTable() {
  const [page, setPage] = useState(1)
  return <section className="history-panel"><div className="history-table-top"><span>Total Data: 124</span></div><div className="prediction-table-scroll"><table className="prediction-table"><thead><tr><th>BULAN/TAHUN</th><th>KODE PRODUK</th><th>ANGKA PREDIKSI</th><th>ANGKA AKTUAL</th><th>SELISIH/ERROR</th><th>STATUS</th></tr></thead><tbody>{historyRows.map((row, index) => <tr className={index === 3 ? 'tinted' : ''} key={`${row.period}-${row.product}`}><td>{row.period}</td><td>{row.product}</td><td>{row.predicted}</td><td>{row.actual}</td><td className={row.difference.startsWith('-') ? 'negative' : 'positive'}>{row.difference}</td><td><span className={`prediction-status ${row.tone}`}>{row.status}</span></td></tr>)}</tbody></table></div><footer className="history-pagination"><span>Showing 1–5 of 124 entries</span><div><button type="button" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}>Prev</button><button className={page === 1 ? 'current' : ''} type="button" onClick={() => setPage(1)}>1</button><button className={page === 2 ? 'current' : ''} type="button" onClick={() => setPage(2)}>2</button><button className={page === 3 ? 'current' : ''} type="button" onClick={() => setPage(3)}>3</button><button type="button" onClick={() => setPage(Math.min(3, page + 1))}>Next</button></div></footer></section>
}

function PredictionHistory() {
  return <div className="prediction-history-shell"><Sidebar activeLabel="History" variant="history" /><div className="prediction-history-main"><header className="prediction-history-topbar" /><main className="prediction-history-content"><header className="history-heading"><h1>Historis Prediksi</h1><p>Tinjau kembali akurasi prediksi penjualan dari periode sebelumnya.</p></header><section className="history-filter"><PeriodPicker /><button className="history-search" type="button"><span className="search-icon" />Cari</button></section><HistoryTable /></main></div></div>
}

export default PredictionHistory
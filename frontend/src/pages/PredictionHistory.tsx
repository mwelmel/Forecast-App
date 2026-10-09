import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Sidebar } from './Dashboard'
import { apiRequest } from '../utils/api'
import './PredictionHistory.css'
import './PredictionHistoryStates.css'

type PredictionHistoryItem = {
  prediction_id: number
  prediction_period: string
  product_code: string
  predicted_quantity: number
  actual_quantity: number | null
  error: number | null
  status: 'Pending' | 'Under-predicted' | 'Over-predicted' | 'Highly Accurate'
}

type PredictionHistoryResponse = {
  data: PredictionHistoryItem[]
  total: number
  page: number
  limit: number
  total_pages: number
  years: number[]
}

const PAGE_SIZE = 10

function PeriodPicker({
  years,
  selectedYear,
  onSelectYear,
}: {
  years: number[]
  selectedYear: number | null
  onSelectYear: (year: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const options: { year: number | null; label: string }[] = [
    { year: null, label: 'Semua Tahun' },
    ...years.map((year) => ({ year, label: `Tahun ${year}` })),
  ]
  const selectedLabel = options.find((option) => option.year === selectedYear)?.label ?? 'Semua Tahun'

  return (
    <div className="period-picker">
      <label>Periode Waktu</label>
      <button
        type="button"
        className="period-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selectedLabel}</span>
        <ChevronDown className="select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="period-menu" role="listbox" aria-label="Pilih tahun">
          {options.map((option) => (
            <button
              className={option.year === selectedYear ? 'selected' : ''}
              type="button"
              role="option"
              aria-selected={option.year === selectedYear}
              key={option.year ?? 'all'}
              onClick={() => {
                onSelectYear(option.year)
                setOpen(false)
              }}
            >
              {option.label}
              {option.year === selectedYear && <Check aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatPeriod(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(date)
}

function getStatusTone(status: PredictionHistoryItem['status']) {
  if (status === 'Under-predicted') return 'under'
  if (status === 'Over-predicted') return 'over'
  if (status === 'Highly Accurate') return 'accurate'
  return 'pending'
}

function HistoryTable({
  rows,
  total,
  page,
  totalPages,
  isLoading,
  errorMessage,
  onPageChange,
}: {
  rows: PredictionHistoryItem[]
  total: number
  page: number
  totalPages: number
  isLoading: boolean
  errorMessage: string
  onPageChange: (page: number) => void
}) {
  const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
  const firstEntry = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const lastEntry = Math.min(page * PAGE_SIZE, total)
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4))
  const pageNumbers = Array.from(
    { length: Math.max(0, Math.min(totalPages, 5)) },
    (_, index) => firstPage + index,
  )

  return (
    <section className="history-panel" aria-label="Riwayat prediksi">
      <div className="history-table-top">
        <span>Total Data: {total}</span>
      </div>
      {errorMessage && <p className="history-feedback" role="alert">{errorMessage}</p>}
      <div className="prediction-table-scroll">
        <table className="prediction-table">
          <thead>
            <tr>
              <th scope="col">BULAN/TAHUN</th>
              <th scope="col">KODE PRODUK</th>
              <th scope="col">ANGKA PREDIKSI</th>
              <th scope="col">ANGKA AKTUAL</th>
              <th scope="col">SELISIH/ERROR</th>
              <th scope="col">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="history-empty" colSpan={6}>Memuat riwayat prediksi...</td></tr>
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.prediction_id}>
                  <td>{formatPeriod(row.prediction_period)}</td>
                  <td>{row.product_code}</td>
                  <td>{numberFormat.format(row.predicted_quantity)}</td>
                  <td>{row.actual_quantity === null ? '—' : numberFormat.format(row.actual_quantity)}</td>
                  <td className={row.error === null || row.error === 0 ? '' : row.error < 0 ? 'negative' : 'positive'}>
                    {row.error === null ? '—' : numberFormat.format(row.error)}
                  </td>
                  <td>
                    <span className={`prediction-status ${getStatusTone(row.status)}`}>{row.status}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td className="history-empty" colSpan={6}>Belum ada riwayat prediksi untuk periode ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="history-pagination">
        <span>
          {isLoading ? 'Memuat data...' : `Menampilkan ${firstEntry}–${lastEntry} dari ${total} data`}
        </span>
        <div>
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft />
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              className={pageNumber === page ? 'current' : ''}
              type="button"
              aria-current={pageNumber === page ? 'page' : undefined}
              key={pageNumber}
              onClick={() => onPageChange(pageNumber)}
              disabled={isLoading}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight />
          </button>
        </div>
      </footer>
    </section>
  )
}

function PredictionHistory() {
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [appliedYear, setAppliedYear] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<PredictionHistoryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (appliedYear !== null) params.set('year', String(appliedYear))

    const loadHistory = async () => {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const result = await apiRequest<PredictionHistoryResponse>(
          `/predict/history?${params.toString()}`,
          { signal: controller.signal },
        )
        setHistory(result)
        setYears(result.years)
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : 'Riwayat prediksi gagal dimuat.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadHistory()
    return () => controller.abort()
  }, [appliedYear, page])

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setAppliedYear(selectedYear)
  }

  return (
    <div className="prediction-history-shell">
      <Sidebar activeLabel="History" />
      <div className="prediction-history-main">
        <header className="prediction-history-topbar" />
        <main className="prediction-history-content">
          <header className="history-heading">
            <h1>Historis Prediksi</h1>
            <p>Tinjau kembali akurasi prediksi penjualan dari periode sebelumnya.</p>
          </header>
          <form className="history-filter" onSubmit={handleSearch}>
            <PeriodPicker years={years} selectedYear={selectedYear} onSelectYear={setSelectedYear} />
            <button className="history-search" type="submit" disabled={isLoading}>
              <Search className="search-icon" aria-hidden="true" />
              Cari
            </button>
          </form>
          <HistoryTable
            rows={history?.data ?? []}
            total={history?.total ?? 0}
            page={page}
            totalPages={history?.total_pages ?? 0}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onPageChange={setPage}
          />
        </main>
      </div>
    </div>
  )
}

export default PredictionHistory

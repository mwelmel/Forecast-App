import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BrainCircuit, Check, ChevronDown, RefreshCw, Sigma, Target, TrendingDown } from 'lucide-react'
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { Sidebar } from './Dashboard'
import { apiRequest } from '../utils/api'
import './ModelSettings.css'

type ModelMetric = {
  metric_id: number
  algorithm_name: string
  // lob: string
  mae: number
  rmse: number
  mape: number
  r2_score: number
  processing_time: number
  // train_rows_count: number
  is_active: boolean
  trained_at: string
}

type RetrainResponse = {
  message: string
  hasil: ModelMetric[]
}

const algorithmLabels: Record<string, string> = {
  random_forest: 'Random Forest Regression',
  extra_trees: 'Extra Trees Regression',
  gradient_boosting: 'Gradient Boosting Regression',
}

const metricDefinitions: { label: string; key: 'mae' | 'rmse' | 'mape' | 'r2_score'; description: string; icon: LucideIcon; variant: string; suffix?: string }[] = [
  { label: 'MAE', key: 'mae', description: 'Mean Absolute Error', icon: Sigma, variant: 'lavender' },
  { label: 'RMSE', key: 'rmse', description: 'Root Mean Square Error', icon: TrendingDown, variant: 'pink' },
  { label: 'sMAPE', key: 'mape', description: 'Symmetric Mean Absolute Percentage Error', icon: Target, variant: 'white', suffix: '%' },
  { label: 'R² Score', key: 'r2_score', description: 'Coefficient of Determination', icon: BrainCircuit, variant: 'white' },
]

function formatMetric(value: number | null | undefined, suffix = '') {
  return value === undefined || value === null || !Number.isFinite(value)
    ? '—'
    : `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)}${suffix}`
}

function formatAlgorithm(name: string) {
  return algorithmLabels[name] ?? name
}

function MetricCard({
  metric,
  value,
}: {
  metric: (typeof metricDefinitions)[number]
  value: number | undefined
}) {
  const Icon = metric.icon
  return (
    <article className={`metric-card ${metric.variant}`}>
      <div className="metric-card-top"><strong>{metric.label}</strong><Icon aria-hidden="true" /></div>
      <div className="metric-value">
        <b>{formatMetric(value)}</b>{metric.suffix && value !== undefined && <span>{metric.suffix}</span>}
        <small>{metric.description}</small>
      </div>
    </article>
  )
}

const chartSeriesDefinitions: { name: string; key: 'mae' | 'rmse' | 'mape'; color: string; suffix?: string }[] = [
  { name: 'MAE', key: 'mae', color: '#5b58ad' },
  { name: 'RMSE', key: 'rmse', color: '#b996fe' },
  { name: 'sMAPE', key: 'mape', color: '#9d4658', suffix: '%' },
]

function ComparisonChart({ metrics }: { metrics: ModelMetric[] }) {
  const series = chartSeriesDefinitions.map((definition) => ({
    name: definition.name,
    data: metrics.map((metric) => (Number.isFinite(metric[definition.key]) ? Number(metric[definition.key]) : 0)),
  }))

  const categories = metrics.map((metric) => {
    const label = formatAlgorithm(metric.algorithm_name).replace(/ Regression$/, '')
    return label === 'Random Forest' ? ['Random', 'Forest'] : [label]
  })

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      animations: { enabled: true, speed: 400 },
    },
    colors: chartSeriesDefinitions.map((definition) => definition.color),
    plotOptions: {
      bar: {
        columnWidth: '62%',
        borderRadius: 2,
        borderRadiusApplication: 'end',
      },
    },
    stroke: { show: true, width: 10, colors: ['transparent'] },
    dataLabels: { enabled: false },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '13px',
      fontWeight: 700,
      labels: { colors: '#808080' },
      markers: { size: 6, shape: 'circle', strokeWidth: 0 },
      itemMargin: { horizontal: 10, vertical: 8 },
    },
    grid: {
      borderColor: '#ecebf2',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 0, right: 0 },
    },
    xaxis: {
      categories,
      axisBorder: { show: true, color: '#ecebf2' },
      axisTicks: { show: false },
      labels: { style: { colors: '#474551', fontSize: '13px', fontWeight: 700 } },
    },
    yaxis: { show: false, min: 0, forceNiceScale: true, tickAmount: 4 },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (value, opts) => formatMetric(value, chartSeriesDefinitions[opts?.seriesIndex ?? -1]?.suffix ?? ''),
      },
    },
  }

  return (
    <div className="comparison-chart">
      <Chart options={options} series={series} type="bar" height={340} />
    </div>
  )
}

function ModelSettings() {
  const [metrics, setMetrics] = useState<ModelMetric[]>([])
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const loadMetrics = useCallback(async (signal?: AbortSignal) => {
    const result = await apiRequest<ModelMetric[]>('/model/metrics', { signal })
    setMetrics(result)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        await loadMetrics(controller.signal)
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : 'Metrik model gagal dimuat.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [loadMetrics])

  const activeModel = metrics.find((metric) => metric.is_active)
  const sortedMetrics = [...metrics].sort((left, right) => left.algorithm_name.localeCompare(right.algorithm_name))

  const retrainModel = async () => {
    setIsBusy(true)
    setErrorMessage('')
    setFeedbackMessage('')
    try {
      const result = await apiRequest<RetrainResponse>('/model/retrain', { method: 'POST' })
      setMetrics(result.hasil)
      setFeedbackMessage(`${result.message} Pilih model utama untuk mulai menggunakannya.`)
      setIsModelMenuOpen(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Retrain model gagal.')
    } finally {
      setIsBusy(false)
    }
  }

  const setPrimaryModel = async (metricId: number) => {
    setIsBusy(true)
    setErrorMessage('')
    setFeedbackMessage('')
    try {
      const result = await apiRequest<{ message: string }>('/model/pilih-utama', {
        method: 'POST',
        body: JSON.stringify({ metric_id: metricId }),
      })
      await loadMetrics()
      setFeedbackMessage(result.message)
      setIsModelMenuOpen(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Model utama gagal diperbarui.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="model-settings-shell">
      <Sidebar activeLabel="Settings" />
      <div className="model-settings-main">
        <header className="model-settings-topbar" />
        <main className="model-settings-content">
          <header className="settings-heading">
            <div><h2>Atur Prediksi &amp; Model</h2><p>Kelola model prediksi berdasarkan evaluasi hasil pelatihan.</p></div>
            <div className="settings-actions">
              <button className="retrain-button" type="button" onClick={() => void retrainModel()} disabled={isBusy}>
                <RefreshCw aria-hidden="true" />{isBusy ? 'Memproses...' : 'Retrain Model (Latih Ulang)'}
              </button>
              <div className="model-picker">
                <button className="primary-model-button" type="button" aria-expanded={isModelMenuOpen} aria-haspopup="listbox" onClick={() => setIsModelMenuOpen((open) => !open)} disabled={isBusy || metrics.length === 0}>
                  <BrainCircuit aria-hidden="true" />Pilih Model Utama<ChevronDown aria-hidden="true" />
                </button>
                {isModelMenuOpen && (
                  <div className="model-menu" role="listbox" aria-label="Pilih model utama">
                    {sortedMetrics.map((metric) => (
                      <button
                        className={`model-option${metric.is_active ? ' selected' : ''}`}
                        type="button"
                        role="option"
                        aria-selected={metric.is_active}
                        key={metric.metric_id}
                        onClick={() => void setPrimaryModel(metric.metric_id)}
                        disabled={isBusy}
                      >
                        {formatAlgorithm(metric.algorithm_name)}
                        {metric.is_active && <><span>(aktif)</span><Check aria-hidden="true" /></>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          {errorMessage && <p className="settings-feedback error" role="alert">{errorMessage}</p>}
          {feedbackMessage && <p className="settings-feedback" role="status">{feedbackMessage}</p>}

          <section className="evaluation-section">
            <div className="metrics-grid">
              {metricDefinitions.map((metric) => (
                <MetricCard key={metric.label} metric={metric} value={activeModel?.[metric.key]} />
              ))}
            </div>
            <section className="algorithm-panel model-comparison">
              <div className="algorithm-heading">
                <h2>Perbandingan Algoritma</h2>
                <p>Akurasi metrik berdasarkan data latih terbaru</p>
              </div>
              {isLoading ? <p className="settings-empty">Memuat metrik model...</p> : sortedMetrics.length === 0 ? (
                <p className="settings-empty">Belum ada metrik model. Jalankan retrain untuk melatih model.</p>
              ) : (
                <ComparisonChart metrics={sortedMetrics} />
              )}
            </section>
          </section>

          <section className="model-status">
            <div className="status-heading"><h2>Status Model Saat Ini</h2></div>
            <div className="status-content">
              <div className="active-model">
                <div>
                  <div className="model-title">
                    <h3>{activeModel ? formatAlgorithm(activeModel.algorithm_name) : 'Belum ada model aktif'}</h3>
                    <span className={activeModel ? '' : 'inactive'}><i />{activeModel ? 'AKTIF' : 'TIDAK AKTIF'}</span>
                  </div>
                  <p>{activeModel ? 'Model ini digunakan untuk menghasilkan prediksi penjualan.' : 'Pilih salah satu hasil pelatihan sebagai model utama untuk mulai membuat prediksi.'}</p>
                </div>
              </div>
              <div className="status-details">
                {/* <div><small>TOTAL DATA LATIH</small><strong>{activeModel ? `${new Intl.NumberFormat('id-ID').format(activeModel.train_rows_count)} baris` : '—'}</strong></div> */}
                <div><small>TERAKHIR DILATIH</small><strong>{activeModel ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activeModel.trained_at)) : '—'}</strong></div>
                <div><small>R² SCORE</small><strong>{activeModel ? formatMetric(activeModel.r2_score) : '—'}</strong></div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default ModelSettings

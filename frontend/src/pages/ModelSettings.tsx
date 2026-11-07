import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BrainCircuit, Check, ChevronDown, Package, RefreshCw, Search, Sigma, Target, TrendingDown } from 'lucide-react'
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { Sidebar } from './Dashboard'
import { apiRequest } from '../utils/api'
import { RETRAIN_STARTED_EVENT, RETRAIN_STATUS_EVENT, formatDuration } from '../components/retrainStatus'
import type { RetrainStatus } from '../components/retrainStatus'
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

type ProductEvaluationOption = {
  product_code: string
  product_name?: string | null
  lob?: string | null
}

type ProductMetricItem = {
  algorithm_name: string
  mae: number
  rmse: number
  smape: number
  r2_score: number
  train_rows?: number | null
  test_rows?: number | null
}

type ProductEvaluationResponse = {
  product_code: string
  product_name?: string | null
  lob?: string | null
  metrics: ProductMetricItem[]
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

function formatMetric(value: number | null | undefined, suffix = '', maxFractionDigits = 2) {
  return value === undefined || value === null || !Number.isFinite(value)
    ? '—'
    : `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: maxFractionDigits, maximumFractionDigits: maxFractionDigits }).format(value)}${suffix}`
}

function formatAlgorithm(name: string) {
  return algorithmLabels[name] ?? name
}

function getCurrentUserRole(): string | null {
  try {
    const raw = localStorage.getItem('user') ?? sessionStorage.getItem('user')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { role?: string }
    return parsed.role ?? null
  } catch {
    return null
  }
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

const productMetricChartConfigs: {
  key: 'mae' | 'rmse' | 'smape' | 'r2_score'
  title: string
  subtitle: string
  interpretation: string
  direction: 'lower' | 'higher'
  yAxisTitle: string
  suffix?: string
  colors: string[]
}[] = [
  {
    key: 'mae',
    title: 'Perbandingan MAE',
    subtitle: 'Mean Absolute Error (Rata-rata selisih absolut prediksi vs aktual)',
    interpretation: 'Semakin kecil semakin baik',
    direction: 'lower',
    yAxisTitle: 'Nilai MAE (Unit)',
    colors: ['#5b58ad', '#7c78d4', '#9e9be8'],
  },
  {
    key: 'rmse',
    title: 'Perbandingan RMSE',
    subtitle: 'Root Mean Square Error (Akar rata-rata kuadrat selisih error)',
    interpretation: 'Semakin kecil semakin baik',
    direction: 'lower',
    yAxisTitle: 'Nilai RMSE (Unit)',
    colors: ['#8c54c9', '#a676de', '#c29df0'],
  },
  {
    key: 'smape',
    title: 'Perbandingan sMAPE (%)',
    subtitle: 'Symmetric Mean Absolute Percentage Error (Persentase tingkat error)',
    interpretation: 'Semakin kecil semakin baik',
    direction: 'lower',
    yAxisTitle: 'sMAPE (%)',
    suffix: '%',
    colors: ['#9d4658', '#b96476', '#d18897'],
  },
  {
    key: 'r2_score',
    title: 'Perbandingan R² Score',
    subtitle: 'Coefficient of Determination (Kesesuaian pola prediksi terhadap data uji)',
    interpretation: 'Semakin besar semakin baik',
    direction: 'higher',
    yAxisTitle: 'Nilai R² Score',
    colors: ['#2b7a69', '#459987', '#6cb8a7'],
  },
]

function SingleMetricBarChart({
  config,
  metrics,
}: {
  config: (typeof productMetricChartConfigs)[number]
  metrics: ProductMetricItem[]
}) {
  const values = metrics.map((m) =>
    Number.isFinite(m[config.key]) ? Number(m[config.key].toFixed(4)) : 0,
  )

  const categories = metrics.map((m) => {
    const label = formatAlgorithm(m.algorithm_name).replace(/ Regression$/, '')
    if (label === 'Random Forest') return ['Random', 'Forest']
    if (label === 'Extra Trees') return ['Extra', 'Trees']
    if (label === 'Gradient Boosting') return ['Gradient', 'Boosting']
    return [label]
  })

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      animations: { enabled: true, speed: 350 },
    },
    colors: config.colors,
    plotOptions: {
      bar: {
        columnWidth: '48%',
        distributed: true,
        borderRadius: 4,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => formatMetric(Number(val), config.suffix ?? '', 2),
      style: {
        fontSize: '11px',
        fontWeight: 700,
        colors: ['#191b22'],
      },
      offsetY: -4,
    },
    legend: { show: false },
    grid: {
      borderColor: '#ecebf2',
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      categories,
      axisBorder: { show: true, color: '#ecebf2' },
      axisTicks: { show: false },
      title: {
        text: 'Algoritma Regresi',
        style: { color: '#6b6878', fontSize: '11px', fontWeight: 700 },
      },
      labels: {
        style: { colors: '#474551', fontSize: '12px', fontWeight: 700 },
      },
    },
    yaxis: {
      forceNiceScale: true,
      tickAmount: 4,
      ...(config.direction === 'lower' ? { min: 0 } : {}),
      title: {
        text: config.yAxisTitle,
        style: { color: '#6b6878', fontSize: '11px', fontWeight: 700 },
      },
      labels: {
        style: { colors: '#6b6878', fontSize: '11px', fontWeight: 600 },
        formatter: (val) => formatMetric(val, config.suffix ?? '', 2),
      },
    },
    tooltip: {
      y: {
        formatter: (val) => formatMetric(val, config.suffix ?? '', 4),
      },
    },
  }

  const series = [
    {
      name: config.title.replace('Perbandingan ', ''),
      data: values,
    },
  ]

  return (
    <article className="product-metric-chart-card">
      <div className="product-metric-chart-header">
        <div>
          <h4>{config.title}</h4>
          <p>{config.subtitle}</p>
        </div>
        <span className={`metric-direction-badge ${config.direction}`}>
          {config.interpretation}
        </span>
      </div>
      <div className="product-metric-chart-body">
        <Chart options={options} series={series} type="bar" height={260} />
      </div>
    </article>
  )
}

function ProductSelectorDropdown({
  products,
  selectedProduct,
  onSelectProduct,
  disabled,
}: {
  products: ProductEvaluationOption[]
  selectedProduct: string
  onSelectProduct: (code: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.product_code.toLowerCase().includes(q) ||
        (p.product_name && p.product_name.toLowerCase().includes(q)) ||
        (p.lob && p.lob.toLowerCase().includes(q)),
    )
  }, [products, searchQuery])

  const selectedObj = products.find((p) => p.product_code === selectedProduct)
  const selectedLabel = selectedObj
    ? `${selectedObj.product_code}${selectedObj.lob ? ` — ${selectedObj.lob}` : ''}`
    : selectedProduct || 'Pilih Kode Produk'

  return (
    <div className="product-eval-picker" ref={containerRef}>
      <label htmlFor="product-eval-trigger">Pilih Kode Produk</label>
      <button
        id="product-eval-trigger"
        type="button"
        className="product-eval-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled || products.length === 0}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Package size={16} aria-hidden="true" />
        <span>{selectedLabel}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className="product-eval-popover" role="listbox" aria-label="Daftar kode produk">
          <div className="product-eval-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              placeholder="Cari kode produk (mis. PRD0005) atau LOB..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="product-eval-list">
            {filteredProducts.length === 0 ? (
              <div className="product-eval-empty-option">Produk tidak ditemukan</div>
            ) : (
              filteredProducts.map((item) => {
                const isSelected = item.product_code === selectedProduct
                return (
                  <button
                    key={item.product_code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`product-eval-option${isSelected ? ' selected' : ''}`}
                    onClick={() => {
                      onSelectProduct(item.product_code)
                      setOpen(false)
                      setSearchQuery('')
                    }}
                  >
                    <div>
                      <strong>{item.product_code}</strong>
                      {item.lob && <small>{item.lob}</small>}
                    </div>
                    {isSelected && <Check size={15} aria-hidden="true" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
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
  // true selama retraining masih berjalan di backend (walaupun halaman sempat ditinggal)
  const [isRetraining, setIsRetraining] = useState(false)
  const handledJobRef = useRef<string | null>(null)

  // State Evaluasi Model Per Produk (khusus super_user)
  const userRole = getCurrentUserRole()
  const isSuperUser = userRole === 'super_user' || userRole === 'admin'
  const [productOptions, setProductOptions] = useState<ProductEvaluationOption[]>([])
  const [selectedProductCode, setSelectedProductCode] = useState<string>('')
  const [productEvaluation, setProductEvaluation] = useState<ProductEvaluationResponse | null>(null)
  // Loading daftar produk: langsung true kalau super_user (tidak perlu setState di dalam effect)
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(isSuperUser)
  const [productListError, setProductListError] = useState<string>('')
  // Kode produk yang hasil fetch-nya sudah selesai (berhasil / gagal)
  const [loadedProductCode, setLoadedProductCode] = useState<string>('')
  // Error disimpan bersama kode produknya, supaya error produk lama tidak ikut tampil
  const [productEvalErrorState, setProductEvalErrorState] = useState<{ code: string; message: string } | null>(null)

  // Status loading & error diturunkan dari state (bukan di-set manual di effect)
  const isLoadingProductEval = selectedProductCode !== '' && loadedProductCode !== selectedProductCode
  const productEvalError =
    productListError ||
    (productEvalErrorState && productEvalErrorState.code === selectedProductCode ? productEvalErrorState.message : '')

  // Saat halaman dibuka, cek apakah ada retraining yang masih berjalan
  useEffect(() => {
    apiRequest<RetrainStatus>('/model/retrain/status')
      .then((status) => {
        setIsRetraining(status.status === 'running')
        // Hasil job lama yang sudah selesai tidak perlu diumumkan ulang di halaman ini
        if (status.status !== 'running' && status.job_id) handledJobRef.current = status.job_id
      })
      .catch(() => {})
  }, [])

  const loadMetrics = useCallback(async (signal?: AbortSignal) => {
    const result = await apiRequest<ModelMetric[]>('/model/metrics', { signal })
    setMetrics(result)
  }, [])

  // Muat daftar produk untuk Evaluasi Model Per Produk
  useEffect(() => {
    if (!isSuperUser) return
    const controller = new AbortController()
    apiRequest<ProductEvaluationOption[]>('/model/evaluation/products', { signal: controller.signal })
      .then((options) => {
        setProductOptions(options)
        if (options.length > 0) {
          setSelectedProductCode((prev) => prev || options[0].product_code)
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProductListError(error instanceof Error ? error.message : 'Gagal memuat daftar produk evaluasi.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingProducts(false)
        }
      })
    return () => controller.abort()
  }, [isSuperUser])

  // Muat hasil evaluasi ketika produk dipilih
  useEffect(() => {
    if (!isSuperUser || !selectedProductCode) return
    const controller = new AbortController()
    const code = selectedProductCode
    apiRequest<ProductEvaluationResponse>(
      `/model/evaluation/product/${encodeURIComponent(code)}`,
      { signal: controller.signal },
    )
      .then((response) => {
        setProductEvaluation(response)
        setProductEvalErrorState(null)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProductEvalErrorState({ code, message: error instanceof Error ? error.message : 'Gagal memuat evaluasi produk.' })
          setProductEvaluation(null)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          // Tandai produk ini sudah selesai dimuat -> isLoadingProductEval otomatis false
          setLoadedProductCode(code)
        }
      })
    return () => controller.abort()
  }, [isSuperUser, selectedProductCode])

  // Terima update status retraining dari RetrainNotifier (polling global)
  useEffect(() => {
    const handleStatus = (event: Event) => {
      const status = (event as CustomEvent<RetrainStatus>).detail
      if (!status) return
      setIsRetraining(status.status === 'running')

      if (status.status === 'running' || !status.job_id) return
      if (handledJobRef.current === status.job_id) return
      handledJobRef.current = status.job_id

      if (status.status === 'success') {
        setErrorMessage('')
        setFeedbackMessage(`Retraining berhasil dalam ${formatDuration(status.duration_seconds)}. ${status.message ?? ''} Pilih model utama untuk mulai menggunakannya.`)
        setIsModelMenuOpen(true)
        void loadMetrics().catch((error: unknown) => {
          setErrorMessage(error instanceof Error ? error.message : 'Metrik model gagal dimuat.')
        })
      } else if (status.status === 'failed') {
        setFeedbackMessage('')
        setErrorMessage(`Retraining gagal setelah ${formatDuration(status.duration_seconds)}: ${status.message ?? 'Terjadi kesalahan.'}`)
      }
    }
    window.addEventListener(RETRAIN_STATUS_EVENT, handleStatus)
    return () => window.removeEventListener(RETRAIN_STATUS_EVENT, handleStatus)
  }, [loadMetrics])

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

  const productMetrics = useMemo(() => {
    return productEvaluation?.metrics ?? []
  }, [productEvaluation])

  // Cari nilai terbaik per metrik pada produk yang sedang dipilih untuk penanda tabel
  const bestProductMetrics = useMemo(() => {
    if (productMetrics.length === 0) return null
    return {
      mae: Math.min(...productMetrics.map((m) => m.mae)),
      rmse: Math.min(...productMetrics.map((m) => m.rmse)),
      smape: Math.min(...productMetrics.map((m) => m.smape)),
      r2_score: Math.max(...productMetrics.map((m) => m.r2_score)),
    }
  }, [productMetrics])

  const retrainModel = async () => {
    setIsBusy(true)
    setErrorMessage('')
    setFeedbackMessage('')
    try {
      const result = await apiRequest<RetrainStatus>('/model/retrain', { method: 'POST' })
      setIsRetraining(result.status === 'running')
      setIsModelMenuOpen(false)
      window.dispatchEvent(new CustomEvent(RETRAIN_STARTED_EVENT, { detail: result }))
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
              <button className="retrain-button" type="button" onClick={() => void retrainModel()} disabled={isBusy || isRetraining}>
                <RefreshCw aria-hidden="true" />{isBusy ? 'Memproses...' : isRetraining ? 'Retraining berjalan...' : 'Retrain Model (Latih Ulang)'}
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

          {/* A. Evaluasi Model Keseluruhan (ALL) */}
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

          {/* B. Evaluasi Model Per Produk (Khusus Super User) */}
          {isSuperUser && (
            <section className="product-evaluation-section" aria-labelledby="product-eval-heading">
              <div className="product-evaluation-header">
                <div className="product-evaluation-title">
                  <span className="section-scope-tag">EVALUASI LEVEL PRODUK</span>
                  <h2 id="product-eval-heading">Evaluasi Model Per Produk</h2>
                  <p>
                    Lihat perbandingan performa model prediksi berdasarkan kode produk. Data evaluasi ini dihasilkan dari proses pelatihan model terbaru.
                  </p>
                </div>

                <ProductSelectorDropdown
                  products={productOptions}
                  selectedProduct={selectedProductCode}
                  onSelectProduct={setSelectedProductCode}
                  disabled={isLoadingProducts}
                />
              </div>

              {productEvalError && (
                <p className="settings-feedback error" role="alert">
                  {productEvalError}
                </p>
              )}

              <div className="product-evaluation-body">
                {productEvaluation && (
                  <div className="selected-product-banner">
                    <div className="selected-product-meta">
                      <small>KODE PRODUK TERPILIH</small>
                      <strong>{productEvaluation.product_code}</strong>
                    </div>
                    {productEvaluation.lob && (
                      <div className="selected-product-meta">
                        <small>LINE OF BUSINESS (LOB)</small>
                        <strong>{productEvaluation.lob}</strong>
                      </div>
                    )}
                    {productMetrics[0]?.train_rows != null && productMetrics[0]?.test_rows != null && (
                      <div className="selected-product-meta">
                        <small>PEMBAGIAN DATA (80:20)</small>
                        <strong>
                          {productMetrics[0].train_rows} Latih / {productMetrics[0].test_rows} Uji
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                {isLoadingProducts || isLoadingProductEval ? (
                  <p className="settings-empty">Memuat hasil evaluasi untuk produk {selectedProductCode || ''}...</p>
                ) : productMetrics.length === 0 ? (
                  <div className="product-eval-empty-state" role="status">
                    <p>
                      Data evaluasi model per produk tidak tersedia untuk kode produk{' '}
                      <strong>{selectedProductCode || 'yang dipilih'}</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Tabel Perbandingan Evaluasi Per Produk */}
                    <div className="product-eval-table-card">
                      <div className="product-eval-subhead">
                        <h3>Tabel Perbandingan Evaluasi Produk ({productEvaluation?.product_code})</h3>
                        <p>
                          Nilai bertanda <span className="best-metric-pill">Terbaik</span> menunjukkan performa paling optimal pada metrik terkait (MAE, RMSE, sMAPE terkecil; R² Score terbesar).
                        </p>
                      </div>
                      <div className="product-eval-table-wrapper">
                        <table className="product-eval-table">
                          <thead>
                            <tr>
                              <th>Algoritma</th>
                              <th>MAE</th>
                              <th>RMSE</th>
                              <th>sMAPE</th>
                              <th>R² Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {productMetrics.map((row) => {
                              const isBestMae = bestProductMetrics && row.mae === bestProductMetrics.mae
                              const isBestRmse = bestProductMetrics && row.rmse === bestProductMetrics.rmse
                              const isBestSmape = bestProductMetrics && row.smape === bestProductMetrics.smape
                              const isBestR2 = bestProductMetrics && row.r2_score === bestProductMetrics.r2_score
                              return (
                                <tr key={row.algorithm_name}>
                                  <td className="algo-name-cell">
                                    <strong>{formatAlgorithm(row.algorithm_name)}</strong>
                                  </td>
                                  <td className={isBestMae ? 'best-metric-cell' : ''}>
                                    <span>{formatMetric(row.mae, '', 4)}</span>
                                    {isBestMae && <em className="best-metric-pill">Terbaik</em>}
                                  </td>
                                  <td className={isBestRmse ? 'best-metric-cell' : ''}>
                                    <span>{formatMetric(row.rmse, '', 4)}</span>
                                    {isBestRmse && <em className="best-metric-pill">Terbaik</em>}
                                  </td>
                                  <td className={isBestSmape ? 'best-metric-cell' : ''}>
                                    <span>{formatMetric(row.smape, '%', 2)}</span>
                                    {isBestSmape && <em className="best-metric-pill">Terbaik</em>}
                                  </td>
                                  <td className={isBestR2 ? 'best-metric-cell' : ''}>
                                    <span>{formatMetric(row.r2_score, '', 4)}</span>
                                    {isBestR2 && <em className="best-metric-pill">Terbaik</em>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Grafik Perbandingan Evaluasi Per Produk (Dipisahkan per metrik agar skala akurat & tidak menyesatkan) */}
                    <div className="product-eval-charts-section">
                      <div className="product-eval-subhead">
                        <h3>Grafik Perbandingan Metrik Evaluasi ({productEvaluation?.product_code})</h3>
                        <p>
                          Setiap metrik ditampilkan pada grafik terpisah karena memiliki satuan, rentang skala, dan arah interpretasi yang berbeda.
                        </p>
                      </div>
                      <div className="product-eval-charts-grid">
                        {productMetricChartConfigs.map((cfg) => (
                          <SingleMetricBarChart key={cfg.key} config={cfg} metrics={productMetrics} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default ModelSettings

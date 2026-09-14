import { useState } from 'react'
import { Sidebar } from './Dashboard'
import './ModelSettings.css'
import type { LucideIcon } from 'lucide-react'
import { BrainCircuit, ChevronDown, Check, RefreshCw, Sigma, Target, TrendingDown } from 'lucide-react'

type Metric = { label: string; value: string; description: string; icon: LucideIcon; variant: string; suffix?: string }

const metrics: Metric[] = [
  { label: 'MAE', value: '12.4', description: 'Mean Absolute Error', icon: Sigma, variant: 'lavender' },
  { label: 'RMSE', value: '18.2', description: 'Root Mean Square Error', icon: TrendingDown, variant: 'pink' },
  { label: 'MAPE', value: '8.5', suffix: '%', description: 'Mean Absolute Pct Error', icon: Target, variant: 'white' },
  { label: 'R² Score', value: '0.94', description: 'Coefficient of Determination', icon: BrainCircuit, variant: 'white' },
]

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon
  return (
    <article className={`metric-card ${metric.variant}`}>
      <div className="metric-card-top"><strong>{metric.label}</strong><Icon aria-hidden="true" /></div>
      <div className="metric-value"><b>{metric.value}</b>{metric.suffix && <span>{metric.suffix}</span>}<small>{metric.description}</small></div>
    </article>
  )
}

const algorithmBars = [
  { name: ['Random', 'Forest'], values: [108, 144, 72] },
  { name: ['Extra Trees'], values: [81, 117, 54] },
  { name: ['Gradient Boosting'], values: [135, 162, 99] },
]

function AlgorithmChart() {
  return (
    <section className="algorithm-panel">
      <div className="algorithm-heading"><h2>Perbandingan Algoritma</h2><p>Akurasi metrik berdasarkan data latih terbaru</p></div>
      <div className="bar-chart">
        <div className="bar-grid"><i /><i /><i /><i /></div>
        {algorithmBars.map((algorithm) => (
          <div className="algorithm-group" key={algorithm.name.join('-')}>
            <div className="bars">{algorithm.values.map((height, index) => <i className={`bar bar-${index}`} style={{ height }} key={height} />)}</div>
            <strong>{algorithm.name.map((line) => <span key={line}>{line}</span>)}</strong>
          </div>
        ))}
      </div>
      <div className="algorithm-legend"><span><i className="bar-0" />MAE</span><span><i className="bar-1" />RMSE</span><span><i className="bar-2" />MAPE</span></div>
    </section>
  )
}

function ModelStatus() {
  return (
    <section className="model-status">
      <div className="status-heading"><h2>Status Model Saat Ini</h2></div>
      <div className="status-content">
        <div className="active-model">
          <div><div className="model-title"><h3>Random Forest Regression</h3><span><i />AKTIF &amp; OPTIMAL</span></div><p>Model ini saat ini digunakan untuk menghasilkan semua prediksi penjualan real-time.</p></div>
        </div>
        <div className="status-details">
          <div><small>TOTAL DATA LATIH</small><strong>5600 Baris</strong></div>
          <div><small>TERAKHIR DILATIH</small><strong>12 Okt 2023, 14:30</strong></div>
          <div><small>AKURASI KESELURUHAN (%)</small><strong>94.2%</strong></div>
        </div>
      </div>
    </section>
  )
}

function ModelSettings() {
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(true)
  const [selectedModel, setSelectedModel] = useState('Random Forest Regression')
  const modelOptions = ['Random Forest Regression', 'Extra Trees Regression', 'Gradient Boosting Regression']

  return (
    <div className="model-settings-shell">
      <Sidebar activeLabel="Settings" />
      <div className="model-settings-main">
        <header className="model-settings-topbar" />
        <main className="model-settings-content">
          <header className="settings-heading">
            <div><h2>Atur Prediksi &amp; Model</h2><p>atur kembali model prediksi penjualan</p></div>
            <div className="settings-actions"><button className="retrain-button" type="button"><RefreshCw aria-hidden="true" />Retrain Model (Latih Ulang)</button><div className="model-picker"><button className="primary-model-button" type="button" aria-expanded={isModelMenuOpen} aria-haspopup="listbox" onClick={() => setIsModelMenuOpen((open) => !open)}><BrainCircuit aria-hidden="true" />Pilih Model Utama<ChevronDown aria-hidden="true" /></button>{isModelMenuOpen && <div className="model-menu" role="listbox" aria-label="Pilih model utama">{modelOptions.map((model) => <button className={`model-option${model === selectedModel ? ' selected' : ''}`} type="button" role="option" aria-selected={model === selectedModel} key={model} onClick={() => { setSelectedModel(model); setIsModelMenuOpen(false) }}>{model === selectedModel ? <>{model}<span>(active)</span><Check aria-hidden="true" /></> : model}</button>)}</div>}</div></div>
          </header>
          <section className="evaluation-section"><div className="metrics-grid">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div><AlgorithmChart /></section>
          <ModelStatus />
        </main>
      </div>
    </div>
  )
}

export default ModelSettings
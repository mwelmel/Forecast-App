import { useEffect, useState } from 'react'
import { CalendarDays, Filter, Package } from 'lucide-react'
import { Sidebar } from './Dashboard'
import { apiRequest } from '../utils/api'
import './Forecasting.css'

type Product = {
  product_code: string
  product_name: string | null
  lob: string
}

type ForecastMonth = {
  tahun: number
  bulan: number
  predicted_quantity: number
}

type Prediction = {
  product_code: string
  algorithm_used: string
  forecast: ForecastMonth[]
}

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function Forecasting() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [horizon, setHorizon] = useState(6)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [isPredicting, setIsPredicting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const loadProducts = async () => {
      try {
        const result = await apiRequest<Product[]>('/predict/products', { signal: controller.signal })
        setProducts(result)
        setSelectedProductCode((current) => current || result[0]?.product_code || '')
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : 'Daftar produk gagal dimuat.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingProducts(false)
      }
    }

    void loadProducts()
    return () => controller.abort()
  }, [])

  const selectedProduct = products.find((product) => product.product_code === selectedProductCode)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProductCode) return

    setIsPredicting(true)
    setErrorMessage('')
    setPrediction(null)

    try {
      const result = await apiRequest<Prediction>('/predict', {
        method: 'POST',
        body: JSON.stringify({ product_code: selectedProductCode, horizon }),
      })
      setPrediction(result)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Prediksi gagal dibuat.')
    } finally {
      setIsPredicting(false)
    }
  }

  return (
    <div className="forecasting-shell">
      <Sidebar activeLabel="Forecast" />
      <div className="forecasting-main">
        <header className="forecasting-topbar" />
        <main className="forecasting-content">
          <form className="forecast-filter" aria-label="Pengaturan prediksi" onSubmit={handleSubmit}>
            <div className="filter-fields">
              <label className="filter-select">
                <Package aria-hidden="true" />
                <select
                  value={selectedProductCode}
                  onChange={(event) => setSelectedProductCode(event.target.value)}
                  disabled={isLoadingProducts || products.length === 0 || isPredicting}
                  aria-label="Pilih produk"
                  required
                >
                  <option value="" disabled>{isLoadingProducts ? 'Memuat produk...' : 'Pilih produk'}</option>
                  {products.map((product) => (
                    <option value={product.product_code} key={product.product_code}>
                      {product.product_code}{product.product_name ? ` - ${product.product_name}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-date">
                <CalendarDays aria-hidden="true" />
                <span>Horizon prediksi</span>
                <select
                  value={horizon}
                  onChange={(event) => setHorizon(Number(event.target.value))}
                  disabled={isPredicting}
                  aria-label="Horizon prediksi"
                >
                  {[1, 2, 3, 4, 5, 6].map((monthCount) => (
                    <option value={monthCount} key={monthCount}>{monthCount} bulan</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="apply-filter" type="submit" disabled={!selectedProductCode || isLoadingProducts || isPredicting}>
              <Filter aria-hidden="true" />
              <span>{isPredicting ? 'Menghitung...' : 'Buat Prediksi'}</span>
            </button>
          </form>

          {errorMessage && <p className="forecast-feedback" role="alert">{errorMessage}</p>}
          {prediction && (
            <section className="forecast-table-panel">
              <div className="forecast-result-heading">
                <div>
                  <h2>Detail Prediksi</h2>
                  <p>{prediction.product_code}{selectedProduct?.lob ? ` · ${selectedProduct.lob}` : ''} · Model: {prediction.algorithm_used}</p>
                </div>
              </div>
              <div className="forecast-table-scroll">
                <table className="forecast-table">
                  <colgroup><col /><col /><col /><col /></colgroup>
                  <thead><tr><th>BULAN</th><th>PRODUK</th><th>UNIT BISNIS</th><th>ESTIMASI PENJUALAN</th></tr></thead>
                  <tbody>
                    {prediction.forecast.map((month) => (
                      <tr key={`${month.tahun}-${month.bulan}`}>
                        <th scope="row">{formatMonth(month.tahun, month.bulan)}</th>
                        <td>{prediction.product_code}</td>
                        <td>{selectedProduct?.lob ?? '-'}</td>
                        <td>{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(month.predicted_quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {!prediction && !errorMessage && !isLoadingProducts && products.length === 0 && (
            <p className="forecast-feedback">Belum ada produk yang dapat diprediksi.</p>
          )}
        </main>
      </div>
    </div>
  )
}

export default Forecasting

import { useEffect, useState } from 'react'
import { Sidebar } from './Dashboard'
import { apiRequest } from '../utils/api'
import productIcon from '../assets/forecasting/product-grid.svg'
import chevronIcon from '../assets/forecasting/chevron-down.svg'
import filterIcon from '../assets/forecasting/filter.svg'
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

type ForecastRow = {
  product: Product
  prediction?: Prediction
  error?: string
}

const PAGE_SIZE = 5
const FORECAST_HORIZON = 6

function monthKey(year: number, month: number) {
  return `${year}-${month}`
}

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1))
    .toLocaleUpperCase('id-ID')
}

function getUpcomingMonths(): ForecastMonth[] {
  const today = new Date()
  return Array.from({ length: FORECAST_HORIZON }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() + index + 1, 1)
    return { tahun: date.getFullYear(), bulan: date.getMonth() + 1, predicted_quantity: 0 }
  })
}

function Forecasting() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [appliedProductCode, setAppliedProductCode] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [forecastRows, setForecastRows] = useState<ForecastRow[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  // const [isPredicting, setIsPredicting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const loadProducts = async () => {
      try {
        const result = await apiRequest<Product[]>('/predict/products', { signal: controller.signal })
        setProducts(result)
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

  const filteredProducts = appliedProductCode
    ? products.filter((product) => product.product_code === appliedProductCode)
    : products
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const pageProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstPrediction = forecastRows.find((row) => row.prediction)?.prediction
  const months = firstPrediction?.forecast.length ? firstPrediction.forecast : getUpcomingMonths()
  const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

  const handleProductChange = (productCode: string) => {
    setSelectedProductCode(productCode)
    setCurrentPage(1)
    setForecastRows([])
    setErrorMessage('')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAppliedProductCode(selectedProductCode)
    setCurrentPage(1)
    setErrorMessage('')
  }

  //   const results = await Promise.all(pageProducts.map(async (product): Promise<ForecastRow> => {
  //     try {
  //       const prediction = await apiRequest<Prediction>('/predict', {
  //         method: 'POST',
  //         body: JSON.stringify({ product_code: product.product_code, horizon: FORECAST_HORIZON }),
  //       })
  //       return { product, prediction }
  //     } catch (error) {
  //       return {
  //         product,
  //         error: error instanceof Error ? error.message : 'Prediksi gagal dibuat.',
  //       }
  //     }
  //   }))

  //   setForecastRows(results)
  //   const failedRows = results.filter((row) => row.error)
  //   if (failedRows.length > 0) {
  //     setErrorMessage(
  //       `Prediksi gagal untuk ${failedRows.map((row) => `${row.product.product_code}: ${row.error}`).join('; ')}`,
  //     )
  //   }
  //   setIsPredicting(false)
  // }

  return (
    <div className="forecasting-shell">
      <Sidebar activeLabel="Forecast" />
      <div className="forecasting-main">
        <main className="forecasting-content">
          <form className="forecast-filter" aria-label="Filter prediksi" onSubmit={handleSubmit}>
            <label className="filter-select">
              <img src={productIcon} alt="" aria-hidden="true" />
              <select
                value={selectedProductCode}
                onChange={(event) => handleProductChange(event.target.value)}
                disabled={isLoadingProducts || products.length === 0}
                aria-label="Pilih produk"
              >
                <option value="">{isLoadingProducts ? 'Memuat produk...' : 'Semua Produk'}</option>
                {products.map((product) => (
                  <option value={product.product_code} key={product.product_code}>
                    {product.product_code}{product.product_name ? ` - ${product.product_name}` : ''}
                  </option>
                ))}
              </select>
              <img className="filter-chevron" src={chevronIcon} alt="" aria-hidden="true" />
            </label>
            <button
              className="apply-filter"
              type="submit"
              disabled={isLoadingProducts}
            >
              <img src={filterIcon} alt="" aria-hidden="true" />
              <span>Terapkan Filter</span>
            </button>
          </form>

          {errorMessage && <p className="forecast-feedback" role="alert">{errorMessage}</p>}

          <section className="forecast-table-panel" aria-labelledby="forecast-table-title">
            <h2 id="forecast-table-title">Detail Prediksi</h2>
            <div className="forecast-table-scroll">
              <table className="forecast-table">
                <colgroup>
                  <col className="product-code-column" />
                  <col className="business-unit-column" />
                  {months.map((month) => <col key={monthKey(month.tahun, month.bulan)} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">KODE PRODUK</th>
                    <th scope="col">UNIT BISNIS</th>
                    {months.map((month) => (
                      <th scope="col" key={monthKey(month.tahun, month.bulan)}>
                        {formatMonth(month.tahun, month.bulan)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageProducts.length > 0 ? pageProducts.map((product) => {
                    const row = forecastRows.find((forecastRow) => forecastRow.product.product_code === product.product_code)
                    const monthlyValues = new Map(
                      row?.prediction?.forecast.map((month) => [
                        monthKey(month.tahun, month.bulan),
                        month.predicted_quantity,
                      ]),
                    )

                    return (
                      <tr key={product.product_code} aria-label={row?.error ? `Gagal: ${row.error}` : undefined}>
                        <th scope="row">{product.product_code}</th>
                        <td><span className="product-lob">{product.lob}</span></td>
                        {months.map((month) => {
                          const value = monthlyValues.get(monthKey(month.tahun, month.bulan))
                          return (
                            <td key={monthKey(month.tahun, month.bulan)}>
                              {value === undefined ? '—' : numberFormat.format(value)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td className="forecast-empty" colSpan={2 + months.length}>
                        {isLoadingProducts ? 'Memuat produk...' : 'Belum ada produk yang dapat diprediksi.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="forecast-table-footer">
              <p>
                Menampilkan <strong>{filteredProducts.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, filteredProducts.length)}</strong>
                {' '}dari <strong>{filteredProducts.length}</strong> total produk aktif
              </p>
              <nav className="forecast-pagination" aria-label="Navigasi halaman produk">
                <button
                  type="button"
                  disabled={currentPage === 1 }
                  onClick={() => {
                    setCurrentPage((page) => page - 1)
                    setForecastRows([])
                    setErrorMessage('')
                  }}
                >
                  Sebelumnya
                </button>
                <span aria-current="page">{currentPage}</span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setCurrentPage((page) => Math.min(page + 1, totalPages))
                    setForecastRows([])
                    setErrorMessage('')
                  }}
                >
                  Selanjutnya
                </button>
              </nav>
            </footer>
          </section>
        </main>
      </div>
    </div>
  )
}

export default Forecasting

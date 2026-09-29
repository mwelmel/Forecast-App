import { useEffect, useState } from 'react'
import { Sidebar } from './Dashboard'
import './ProductData.css'
import { ChevronLeft, ChevronRight, Edit3, Plus, Search, Trash2, X } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const PAGE_SIZE = 10

type Product = {
  product_id: number
  product_code: string
  product_name: string | null
  lob: string
  lead_time: number
  created_at: string
}

type ProductPayload = {
  product_code: string
  product_name: string | null
  lob: string
  lead_time: number
}

type ProductForm = {
  product_code: string
  product_name: string
  lob: string
  lead_time: string
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = typeof data === 'object' && data !== null && 'detail' in data ? data.detail : null
    throw new Error(typeof detail === 'string' ? detail : 'Permintaan produk gagal diproses.')
  }

  return data as T
}

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null
  onClose: () => void
  onSaved: (product: Product) => void
}) {
  const [form, setForm] = useState<ProductForm>({
    product_code: product?.product_code ?? '',
    product_name: product?.product_name ?? '',
    lob: product?.lob ?? '',
    lead_time: product ? String(product.lead_time) : '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage('')

    const payload: ProductPayload = {
      product_code: form.product_code.trim(),
      product_name: form.product_name.trim() || null,
      lob: form.lob.trim(),
      lead_time: Number(form.lead_time),
    }

    try {
      const savedProduct = await apiRequest<Product>(product ? `/api/products/${product.product_id}` : '/api/products', {
        method: product ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      onSaved(savedProduct)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Data produk gagal disimpan.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  return (
    <div className="product-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <header className="product-modal-heading">
          <h2 id="product-modal-title">{product ? 'Edit Produk' : 'Tambah Produk'}</h2>
          <button type="button" className="product-modal-close" onClick={onClose} disabled={isSaving} aria-label="Tutup">
            <X aria-hidden="true" />
          </button>
        </header>
        <form className="product-form" onSubmit={handleSubmit}>
          <label>Kode Produk<input name="product_code" value={form.product_code} onChange={updateField} maxLength={100} required /></label>
          <label>Nama Produk<input name="product_name" value={form.product_name} onChange={updateField} maxLength={100} /></label>
          <label>Unit Bisnis / LOB<input name="lob" value={form.lob} onChange={updateField} maxLength={50} required /></label>
          <label>Waktu Tunggu (hari)<input name="lead_time" type="number" value={form.lead_time} onChange={updateField} min={0} step={1} required /></label>
          {errorMessage && <p className="product-form-error" role="alert">{errorMessage}</p>}
          <footer className="product-modal-actions">
            <button type="button" className="product-cancel" onClick={onClose} disabled={isSaving}>Batal</button>
            <button type="submit" className="product-save" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function ProductTable() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeProduct, setActiveProduct] = useState<Product | null | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    const loadProducts = async () => {
      setIsLoading(true)
      try {
        const data = await apiRequest<Product[]>('/api/products', { signal: controller.signal })
        setProducts(data)
        setErrorMessage('')
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : 'Data produk gagal dimuat.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadProducts()
    return () => controller.abort()
  }, [])

  const filteredProducts = products.filter((product) =>
    `${product.product_code} ${product.product_name ?? ''} ${product.lob}`.toLowerCase().includes(query.toLowerCase()),
  )
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const saveProduct = (savedProduct: Product) => {
    setProducts((current) => {
      const exists = current.some((product) => product.product_id === savedProduct.product_id)
      return exists
        ? current.map((product) => product.product_id === savedProduct.product_id ? savedProduct : product)
        : [...current, savedProduct].sort((left, right) => left.product_id - right.product_id)
    })
    setActiveProduct(undefined)
    setErrorMessage('')
  }

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Hapus produk ${product.product_code}?`)) return

    try {
      await apiRequest<{ message: string }>(`/api/products/${product.product_id}`, { method: 'DELETE' })
      setProducts((current) => current.filter((item) => item.product_id !== product.product_id))
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Produk gagal dihapus.')
    }
  }

  const firstItem = filteredProducts.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const lastItem = Math.min(currentPage * PAGE_SIZE, filteredProducts.length)

  return (
    <section className="product-panel">
      <div className="product-toolbar">
        <label className="product-search"><Search className="search-icon" aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Cari produk..." aria-label="Cari produk" /></label>
        <button className="add-product" type="button" onClick={() => setActiveProduct(null)}><Plus aria-hidden="true" />Tambah Produk Baru</button>
      </div>
      {errorMessage && <p className="product-feedback" role="alert">{errorMessage}</p>}
      <div className="product-table-scroll"><table className="product-table"><thead><tr><th>Kode Produk</th><th>Nama Produk</th><th>Unit Bisnis</th><th>Waktu Tunggu (Lead Time)</th><th>Aksi</th></tr></thead><tbody>
        {isLoading ? <tr><td className="product-empty" colSpan={5}>Memuat data produk...</td></tr> : visibleProducts.length ? visibleProducts.map((product) => <tr key={product.product_id}><td>{product.product_code}</td><td>{product.product_name || '-'}</td><td><span className="unit-badge">{product.lob}</span></td><td>{product.lead_time} Hari</td><td><div className="row-actions"><button type="button" aria-label={`Edit ${product.product_code}`} onClick={() => setActiveProduct(product)}><Edit3 className="edit-icon" /></button><button type="button" aria-label={`Hapus ${product.product_code}`} onClick={() => void deleteProduct(product)}><Trash2 className="delete-icon" /></button></div></td></tr>) : <tr><td className="product-empty" colSpan={5}>{errorMessage ? 'Data produk tidak tersedia.' : query ? 'Produk tidak ditemukan.' : 'Belum ada data produk.'}</td></tr>}
      </tbody></table></div>
      <footer className="product-pagination"><span>Menampilkan {firstItem}-{lastItem} dari {filteredProducts.length} produk</span><div><button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Halaman sebelumnya"><ChevronLeft /></button><span className="product-page-count">{currentPage} / {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="Halaman berikutnya"><ChevronRight /></button></div></footer>
      {activeProduct !== undefined && <ProductModal product={activeProduct} onClose={() => setActiveProduct(undefined)} onSaved={saveProduct} />}
    </section>
  )
}

function ProductData() {
  return <div className="product-data-shell"><Sidebar activeLabel="Inventory" activeSubLabel="Data Produk" /><div className="product-data-main"><header className="product-data-topbar" /><main className="product-data-content"><h1>Kelola Data Produk</h1><ProductTable /></main></div></div>
}

export default ProductData
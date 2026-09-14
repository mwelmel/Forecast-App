import { useState } from 'react'
import { Sidebar } from './Dashboard'
import './ProductData.css'
import { ChevronLeft, ChevronRight, Edit3, Plus, Search, Trash2 } from 'lucide-react'

const products = [
  { code: 'PRD-001', name: 'jksdkaakdask', unit: '2HBLE', leadTime: '90 Hari' },
  { code: 'PRD-002', name: 'sjwkskkklaa', unit: '2HBLE', leadTime: '5 Hari' },
  { code: 'PRD-003', name: 'vbasdakd', unit: '2HBLE', leadTime: '2 Hari' },
  { code: 'PRD-004', name: 'vjlalksls', unit: '2HBLE', leadTime: '7 Hari' },
]

function ProductTable() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const visibleProducts = products.filter((product) => `${product.code} ${product.name}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <section className="product-panel">
      <div className="product-toolbar">
        <label className="product-search"><Search className="search-icon" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." aria-label="Search products" /></label>
        <button className="add-product" type="button"><Plus aria-hidden="true" />Tambah Produk Baru</button>
      </div>
      <div className="product-table-scroll"><table className="product-table"><thead><tr><th>Kode Produk</th><th>Nama Produk</th><th>Unit Bisnis</th><th>Waktu Tunggu (Lead Time)</th><th>Aksi</th></tr></thead><tbody>{visibleProducts.map((product) => <tr key={product.code}><td>{product.code}</td><td>{product.name}</td><td><span className="unit-badge">{product.unit}</span></td><td>{product.leadTime}</td><td><div className="row-actions"><button type="button" aria-label={`Edit ${product.code}`}><Edit3 className="edit-icon" /></button><button type="button" aria-label={`Hapus ${product.code}`}><Trash2 className="delete-icon" /></button></div></td></tr>)}</tbody></table></div>
      <footer className="product-pagination"><span>Showing 1 to 4 of 42 entries</span><div><button type="button" disabled={page === 1} aria-label="Halaman sebelumnya"><ChevronLeft /></button><button className={page === 1 ? 'current' : ''} type="button" onClick={() => setPage(1)}>1</button><button className={page === 2 ? 'current' : ''} type="button" onClick={() => setPage(2)}>2</button><button className={page === 3 ? 'current' : ''} type="button" onClick={() => setPage(3)}>3</button><i>...</i><button type="button" onClick={() => setPage(10)}>10</button><button type="button" onClick={() => setPage(Math.min(10, page + 1))} aria-label="Halaman berikutnya"><ChevronRight /></button></div></footer>
    </section>
  )
}

function ProductData() {
  return <div className="product-data-shell"><Sidebar activeLabel="Inventory" activeSubLabel="Data Produk" /><div className="product-data-main"><header className="product-data-topbar" /><main className="product-data-content"><h1>Kelola Data Produk</h1><ProductTable /></main></div></div>
}

export default ProductData
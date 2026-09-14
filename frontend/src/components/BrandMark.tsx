import { BarChart3 } from 'lucide-react'

type BrandMarkProps = {
  title?: string
}

function BrandMark({ title = 'Prediksi Penjualan Produk' }: BrandMarkProps) {
  return (
    <div className="login-brand" aria-label={title}>
      <div className="login-brand-icon" aria-hidden="true">
        <BarChart3 aria-hidden="true" />
      </div>
      <h1 className="login-brand-title">{title}</h1>
    </div>
  )
}

export default BrandMark
